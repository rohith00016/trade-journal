import { JournalEntry } from '../models';
import { IJournalEntry } from '../models/JournalEntry';
import { ITrade } from '../models/Trade';
import { migrateLegacyJournal } from './journal.service';

/** Thresholds for “how often did Max RR reach at least X?” */
const MAX_RR_HIT_THRESHOLDS = [0.5, 1, 1.5, 2, 2.5, 3];

/** Exclusive upper edges for peak distribution (last bucket is open-ended). */
const MAX_RR_PEAK_EDGES = [0.5, 1, 1.5, 2, 2.5, 3];

export interface PerformanceSummary {
  totalTrades: number;
  winners: number;
  losers: number;
  breakevens: number;
  winRate: number;
  totalPnl: number;
  totalR: number;
  profitFactor: number | null;
  expectancy: number;
  averageWin: number;
  averageLoss: number;
  averageR: number;
  maxDrawdownR: number;
  currentStreak: number;
  bestStrategy?: { name: string; expectancy: number };
  bestHour?: { hour: number; expectancy: number };
}

function isWin(t: ITrade) {
  return t.resultR > 0;
}
function isLoss(t: ITrade) {
  return t.resultR < 0;
}

/** Hour-of-day in Asia/Kolkata (IST, UTC+5:30). */
function hourInIst(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  return Number(hour ?? 0);
}

/** Minutes since midnight in Asia/Kolkata. */
function minuteOfDayIst(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function slotStartMinutes(minuteOfDay: number, slotMinutes: number) {
  return Math.floor(minuteOfDay / slotMinutes) * slotMinutes;
}

function slotClockLabel(startMin: number) {
  const h = Math.floor(startMin / 60) % 24;
  const m = startMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calcProfitFactor(trades: ITrade[]) {
  const grossProfit = trades
    .filter(isWin)
    .reduce((s, t) => s + Math.abs(t.resultUsd || 0), 0);
  const grossLoss = trades
    .filter(isLoss)
    .reduce((s, t) => s + Math.abs(t.resultUsd || 0), 0);
  // Infinity is not JSON-serializable (becomes null) — use null as "infinite"
  if (grossLoss === 0) return grossProfit > 0 ? null : 0;
  return Number((grossProfit / grossLoss).toFixed(2));
}

function calcMaxDrawdownR(trades: ITrade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of sorted) {
    equity += t.resultR;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }
  return Number(maxDd.toFixed(2));
}

function calcCurrentStreak(trades: ITrade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  if (!sorted.length) return 0;
  const firstSign = Math.sign(sorted[0].resultR);
  if (firstSign === 0) return 0;
  let streak = 0;
  for (const t of sorted) {
    const sign = Math.sign(t.resultR);
    if (sign === firstSign) streak += 1;
    else break;
  }
  return firstSign * streak;
}

function expectancy(trades: ITrade[]) {
  if (!trades.length) return 0;
  const totalR = trades.reduce((s, t) => s + t.resultR, 0);
  return Number((totalR / trades.length).toFixed(3));
}

function avgOrNull(nums: number[]) {
  if (!nums.length) return null;
  return Number((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(3));
}

type TradeLike = {
  resultR?: number;
  maximumRr?: number;
};

export interface MaxRrInsights {
  sample: number;
  avgMaxRr: number | null;
  medianMaxRr: number | null;
  /** % of trades whose Max RR reached at least this level */
  hitRates: Array<{
    thresholdR: number;
    label: string;
    count: number;
    pct: number;
  }>;
  /** Where Max RR peaked (each trade counted once) */
  peakBuckets: Array<{
    fromR: number;
    toR: number | null;
    label: string;
    count: number;
    pct: number;
  }>;
  mostCommonPeak?: {
    label: string;
    count: number;
    pct: number;
  };
  note: string;
}

function medianOrNull(nums: number[]) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(3));
  }
  return Number(sorted[mid]!.toFixed(3));
}

function peakBucketLabel(fromR: number, toR: number | null) {
  if (toR == null) return `≥ ${fromR}R`;
  if (fromR === 0) return `< ${toR}R`;
  return `${fromR}–${toR}R`;
}

/** Max RR distribution — choose BE levels from where price typically ran. */
export function computeMaxRrInsights(trades: TradeLike[]): MaxRrInsights {
  const maxes = trades
    .map((t) => t.maximumRr)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0);

  const sample = maxes.length;
  const pctOf = (count: number) =>
    sample === 0 ? 0 : Number(((count / sample) * 100).toFixed(1));

  const hitRates = MAX_RR_HIT_THRESHOLDS.map((thresholdR) => {
    const count = maxes.filter((m) => m >= thresholdR).length;
    return {
      thresholdR,
      label: `≥ ${thresholdR}R`,
      count,
      pct: pctOf(count),
    };
  });

  const edges = MAX_RR_PEAK_EDGES;
  const peakBuckets: MaxRrInsights['peakBuckets'] = [];
  // < first edge
  {
    const fromR = 0;
    const toR = edges[0]!;
    const count = maxes.filter((m) => m < toR).length;
    peakBuckets.push({
      fromR,
      toR,
      label: peakBucketLabel(fromR, toR),
      count,
      pct: pctOf(count),
    });
  }
  for (let i = 0; i < edges.length - 1; i++) {
    const fromR = edges[i]!;
    const toR = edges[i + 1]!;
    const count = maxes.filter((m) => m >= fromR && m < toR).length;
    peakBuckets.push({
      fromR,
      toR,
      label: peakBucketLabel(fromR, toR),
      count,
      pct: pctOf(count),
    });
  }
  // ≥ last edge
  {
    const fromR = edges[edges.length - 1]!;
    const count = maxes.filter((m) => m >= fromR).length;
    peakBuckets.push({
      fromR,
      toR: null,
      label: peakBucketLabel(fromR, null),
      count,
      pct: pctOf(count),
    });
  }

  let mostCommonPeak: MaxRrInsights['mostCommonPeak'];
  for (const b of peakBuckets) {
    if (b.count === 0) continue;
    if (!mostCommonPeak || b.count > mostCommonPeak.count) {
      mostCommonPeak = { label: b.label, count: b.count, pct: b.pct };
    }
  }

  return {
    sample,
    avgMaxRr: avgOrNull(maxes),
    medianMaxRr: medianOrNull(maxes),
    hitRates,
    peakBuckets,
    mostCommonPeak,
    note: 'Hit rates = % of trades that reached at least that Max RR. Peak buckets = where Max RR landed. Use this to pick a BE level (e.g. if few trades ever hit 2R, BE at 2R is rare).',
  };
}

export function computePerformance(trades: ITrade[]): PerformanceSummary {
  const winners = trades.filter(isWin);
  const losers = trades.filter(isLoss);
  const breakevens = trades.filter((t) => t.resultR === 0);

  const avgWin =
    winners.length === 0
      ? 0
      : winners.reduce((s, t) => s + (t.resultUsd || 0), 0) / winners.length;
  const avgLoss =
    losers.length === 0
      ? 0
      : losers.reduce((s, t) => s + (t.resultUsd || 0), 0) / losers.length;
  const avgR =
    trades.length === 0
      ? 0
      : trades.reduce((s, t) => s + t.resultR, 0) / trades.length;

  // Best strategy by expectancy (min 3 trades)
  const byStrategy = new Map<string, ITrade[]>();
  for (const t of trades) {
    const key = t.strategyName || 'Unassigned';
    if (!byStrategy.has(key)) byStrategy.set(key, []);
    byStrategy.get(key)!.push(t);
  }
  let bestStrategy: PerformanceSummary['bestStrategy'];
  for (const [name, group] of byStrategy) {
    if (group.length < 3) continue;
    const exp = expectancy(group);
    if (!bestStrategy || exp > bestStrategy.expectancy) {
      bestStrategy = { name, expectancy: exp };
    }
  }

  // Best hour by expectancy (min 3 trades) — IST
  const byHour = new Map<number, ITrade[]>();
  for (const t of trades) {
    const hour = hourInIst(new Date(t.date));
    if (!byHour.has(hour)) byHour.set(hour, []);
    byHour.get(hour)!.push(t);
  }
  let bestHour: PerformanceSummary['bestHour'];
  for (const [hour, group] of byHour) {
    if (group.length < 3) continue;
    const exp = expectancy(group);
    if (!bestHour || exp > bestHour.expectancy) {
      bestHour = { hour, expectancy: exp };
    }
  }

  return {
    totalTrades: trades.length,
    winners: winners.length,
    losers: losers.length,
    breakevens: breakevens.length,
    winRate:
      trades.length === 0
        ? 0
        : Number(((winners.length / trades.length) * 100).toFixed(1)),
    totalPnl: Number(
      trades.reduce((s, t) => s + (t.resultUsd || 0) - (t.commission || 0), 0).toFixed(2)
    ),
    totalR: Number(trades.reduce((s, t) => s + t.resultR, 0).toFixed(2)),
    profitFactor: calcProfitFactor(trades),
    expectancy: expectancy(trades),
    averageWin: Number(avgWin.toFixed(2)),
    averageLoss: Number(avgLoss.toFixed(2)),
    averageR: Number(avgR.toFixed(3)),
    maxDrawdownR: calcMaxDrawdownR(trades),
    currentStreak: calcCurrentStreak(trades),
    bestStrategy,
    bestHour,
  };
}

export function computeEquityCurve(trades: ITrade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let equityR = 0;
  let equityUsd = 0;
  return sorted.map((t) => {
    equityR += t.resultR;
    equityUsd += (t.resultUsd || 0) - (t.commission || 0);
    return {
      date: t.date,
      tradeId: String(t._id),
      symbol: t.symbol,
      resultR: t.resultR,
      resultUsd: t.resultUsd || 0,
      equityR: Number(equityR.toFixed(2)),
      equityUsd: Number(equityUsd.toFixed(2)),
    };
  });
}

export function computeCalendarHeatmap(trades: ITrade[]) {
  const map = new Map<string, { date: string; pnl: number; r: number; count: number }>();
  for (const t of trades) {
    const key = new Date(t.date).toISOString().slice(0, 10);
    const row = map.get(key) ?? { date: key, pnl: 0, r: 0, count: 0 };
    row.pnl += (t.resultUsd || 0) - (t.commission || 0);
    row.r += t.resultR;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].map((d) => ({
    ...d,
    pnl: Number(d.pnl.toFixed(2)),
    r: Number(d.r.toFixed(2)),
  }));
}

export function computeChecklistImpact(trades: ITrade[]) {
  const itemStats = new Map<
    string,
    {
      itemLabel: string;
      withChecked: ITrade[];
      withoutChecked: ITrade[];
    }
  >();

  for (const trade of trades) {
    if (!trade.checklist?.length) continue;
    for (const item of trade.checklist) {
      const key = `${item.categoryName}::${item.itemLabel}`;
      if (!itemStats.has(key)) {
        itemStats.set(key, {
          itemLabel: item.itemLabel,
          withChecked: [],
          withoutChecked: [],
        });
      }
      const bucket = itemStats.get(key)!;
      if (item.checked) bucket.withChecked.push(trade);
      else bucket.withoutChecked.push(trade);
    }
  }

  const verdictRank = { cut: 0, review: 1, keep: 2, needs_data: 3 } as const;

  return [...itemStats.entries()]
    .map(([key, value]) => {
      const [categoryName] = key.split('::');
      const withWinRate =
        value.withChecked.length === 0
          ? 0
          : (value.withChecked.filter(isWin).length / value.withChecked.length) *
            100;
      const withoutWinRate =
        value.withoutChecked.length === 0
          ? 0
          : (value.withoutChecked.filter(isWin).length /
              value.withoutChecked.length) *
            100;

      const withExpectancy = expectancy(value.withChecked);
      const withoutExpectancy = expectancy(value.withoutChecked);
      const deltaExpectancy = Number((withExpectancy - withoutExpectancy).toFixed(3));
      const withCount = value.withChecked.length;
      const withoutCount = value.withoutChecked.length;
      const sampleReady = withCount >= 3 && withoutCount >= 3;

      let verdict: 'keep' | 'review' | 'cut' | 'needs_data';
      let verdictHint: string;

      if (!sampleReady) {
        verdict = 'needs_data';
        verdictHint = `Need ≥3 with and ≥3 without (now ${withCount}/${withoutCount}). Keep logging both ways.`;
      } else if (deltaExpectancy >= 0.15) {
        verdict = 'keep';
        verdictHint = 'Checked trades earn clearly more R — keep as a required rule.';
      } else if (deltaExpectancy <= 0) {
        verdict = 'cut';
        verdictHint =
          'Without this box, expectancy is the same or better — safe to remove so you don’t miss trades.';
      } else {
        verdict = 'review';
        verdictHint =
          'Only a small edge when checked — consider making it optional or redefine the rule.';
      }

      return {
        categoryName,
        itemLabel: value.itemLabel,
        withCount,
        withoutCount,
        withWinRate: Number(withWinRate.toFixed(1)),
        withoutWinRate: Number(withoutWinRate.toFixed(1)),
        withExpectancy,
        withoutExpectancy,
        deltaWinRate: Number((withWinRate - withoutWinRate).toFixed(1)),
        deltaExpectancy,
        sampleReady,
        verdict,
        verdictHint,
      };
    })
    .sort((a, b) => {
      const vr = verdictRank[a.verdict] - verdictRank[b.verdict];
      if (vr !== 0) return vr;
      return a.deltaExpectancy - b.deltaExpectancy;
    });
}

export async function getDashboardAnalytics(
  userId: string,
  filters: { from?: Date; to?: Date; accountId?: string; strategyId?: string } = {}
) {
  await migrateLegacyJournal(userId);

  const query: Record<string, unknown> = { userId, source: 'taken' };
  if (filters.accountId) query.accountId = filters.accountId;
  if (filters.strategyId) query.strategyId = filters.strategyId;
  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }

  const entries = await JournalEntry.find(query).sort({ date: -1 });
  const trades = entries as unknown as ITrade[];
  const performance = computePerformance(trades);
  const equityCurve = computeEquityCurve(trades);
  const calendarHeatmap = computeCalendarHeatmap(trades);
  const maxRr = computeMaxRrInsights(
    entries.map((e) => ({
      resultR: e.resultR,
      maximumRr: e.maximumRr,
    }))
  );
  const recentTrades = trades.slice(0, 10);
  const monthlyPerformance = (() => {
    const map = new Map<string, { month: string; pnl: number; r: number; trades: number }>();
    for (const t of trades) {
      const month = new Date(t.date).toISOString().slice(0, 7);
      const row = map.get(month) ?? { month, pnl: 0, r: 0, trades: 0 };
      row.pnl += (t.resultUsd || 0) - (t.commission || 0);
      row.r += t.resultR;
      row.trades += 1;
      map.set(month, row);
    }
    return [...map.values()]
      .map((m) => ({
        ...m,
        pnl: Number(m.pnl.toFixed(2)),
        r: Number(m.r.toFixed(2)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  })();

  return {
    performance,
    equityCurve,
    calendarHeatmap,
    monthlyPerformance,
    recentTrades,
    checklistImpact: computeChecklistImpact(trades),
    maxRr,
  };
}

export type AnalyticsSource = 'taken' | 'not_taken' | 'combined';

type UnifiedEvent = {
  source: 'taken' | 'not_taken';
  at: Date;
  dayKey: string;
  hour: number;
  minuteOfDay: number;
  setupIndex: number;
  strategyName: string;
  maximumRr?: number;
  /** Max R before first retest of entry */
  maxBeforeRetest?: number;
  resultR?: number;
  outcome?: 'win' | 'loss' | 'be' | 'unknown';
  checklist: ITrade['checklist'];
};

export type TimeSlotMinutes = 15 | 30 | 60;

/** Candidate TPs — % of trades whose Max RR reached at least this. */
const TP_HIT_THRESHOLDS = [1, 1.2, 1.5, 2];
/** Suggested TP = highest threshold that still hits this often. */
const SUGGESTED_TP_MIN_HIT_PCT = 60;
/** Ignore noise scratches — only count retest peaks at/above this. */
const BE_RETEST_MIN_R = 0.5;
const BE_CANDIDATE_LEVELS = [0.5, 1, 1.2, 1.5, 2];
/** Need at least this many BE triggers at a level to trust the counterfactual. */
const BE_OUTCOME_MIN_TRIGGERS = 2;

export type BeSource = 'outcome' | 'retest' | 'max_rr_fallback' | null;
export type BeVerdict = 'protect' | 'hold' | null;

export type BeLevelScore = {
  levelR: number;
  triggered: number;
  lossesSaved: number;
  winnersCut: number;
  savedR: number;
  cutR: number;
  /** Counterfactual avg R − actual avg R over scored trades */
  deltaExpectancy: number | null;
};

export type BeAnalysis = {
  withRetestSample: number;
  medianMaxBeforeRetest: number | null;
  scoredSample: number;
  levels: BeLevelScore[];
  suggestedBeR: number | null;
  beSource: BeSource;
  beVerdict: BeVerdict;
  /** Net ΔR/trade at the chosen protect level (if any) */
  beDeltaExpectancy: number | null;
  hint: string | null;
};

export interface BestTimeSlot {
  /** Minutes from midnight IST */
  startMin: number;
  /** Clock label e.g. "07:30" */
  label: string;
  count: number;
  winRate: number | null;
  /** Trades in this slot that have Max RR logged */
  withMaxSample: number;
  /** % of trades (with Max RR) that reached ≥ each TP level */
  hitRates: Array<{
    thresholdR: number;
    label: string;
    count: number;
    pct: number | null;
  }>;
  /**
   * Highest TP among candidates that still hits ≥60% of the time.
   * Use this when you want a target that fills often.
   */
  suggestedTpR: number | null;
  /** Avg Result R (expectancy) for taken trades in this slot */
  expectancy: number | null;
}

function hitRatesForMaxes(maxes: number[]) {
  const sample = maxes.length;
  return TP_HIT_THRESHOLDS.map((thresholdR) => {
    const count = maxes.filter((m) => m >= thresholdR).length;
    return {
      thresholdR,
      label: `≥${thresholdR}R`,
      count,
      pct: sample === 0 ? null : Number(((count / sample) * 100).toFixed(1)),
    };
  });
}

function suggestedTpFromHits(
  hitRates: Array<{ thresholdR: number; pct: number | null }>
): number | null {
  let suggested: number | null = null;
  for (const h of hitRates) {
    if (h.pct != null && h.pct >= SUGGESTED_TP_MIN_HIT_PCT) {
      suggested = h.thresholdR;
    }
  }
  return suggested;
}

/** BE trigger: highest level with ≥70% hits that stays below TP. */
function suggestedBeFromHits(
  hitRates: Array<{ thresholdR: number; pct: number | null }>,
  tpR: number | null
): number | null {
  let be: number | null = null;
  for (const h of hitRates) {
    if (h.pct == null || h.pct < 70) continue;
    if (tpR != null && h.thresholdR >= tpR) continue;
    be = h.thresholdR;
  }
  if (be == null && tpR != null) {
    const below = hitRates
      .map((h) => h.thresholdR)
      .filter((r) => r < tpR)
      .sort((a, b) => b - a);
    be = below[0] ?? null;
  }
  return be;
}

/**
 * BE from max-before-retest: highest candidate ≤ median peak (and below TP).
 * Only peaks ≥ BE_RETEST_MIN_R count (noise scratches ignored).
 */
function meaningfulRetestPeaks(list: UnifiedEvent[]) {
  return list
    .map((e) => e.maxBeforeRetest)
    .filter(
      (n): n is number =>
        typeof n === 'number' && Number.isFinite(n) && n >= BE_RETEST_MIN_R
    );
}

function suggestedBeFromRetests(
  peaks: number[],
  tpR: number | null
): number | null {
  if (!peaks.length) return null;
  const med = medianOrNull(peaks);
  if (med == null) return null;

  let be: number | null = null;
  for (const r of BE_CANDIDATE_LEVELS) {
    if (r > med) break;
    if (tpR != null && r >= tpR) break;
    be = r;
  }
  return be;
}

/**
 * Counterfactual: if stop moved to BE after price reached levelR then retested entry,
 * losses that triggered become 0R (saved); winners that triggered become 0R (cut).
 * Trades without a logged maxBeforeRetest are unchanged (rule never assumed to fire).
 */
function scoreBeLevel(
  scored: Array<{ resultR: number; maxBeforeRetest: number }>,
  levelR: number
): BeLevelScore {
  let triggered = 0;
  let lossesSaved = 0;
  let winnersCut = 0;
  let savedR = 0;
  let cutR = 0;
  let actualSum = 0;
  let cfSum = 0;

  for (const t of scored) {
    actualSum += t.resultR;
    const fires = t.maxBeforeRetest >= levelR;
    if (!fires) {
      cfSum += t.resultR;
      continue;
    }
    triggered += 1;
    // Flattened at BE on retest
    cfSum += 0;
    if (t.resultR < 0) {
      lossesSaved += 1;
      savedR += -t.resultR;
    } else if (t.resultR > 0) {
      winnersCut += 1;
      cutR += t.resultR;
    }
  }

  const n = scored.length;
  const deltaExpectancy =
    n === 0 ? null : Number(((cfSum - actualSum) / n).toFixed(3));

  return {
    levelR,
    triggered,
    lossesSaved,
    winnersCut,
    savedR: Number(savedR.toFixed(3)),
    cutR: Number(cutR.toFixed(3)),
    deltaExpectancy,
  };
}

function analyzeBeFromOutcomes(
  list: UnifiedEvent[],
  suggestedTpR: number | null
): BeAnalysis {
  const peaks = meaningfulRetestPeaks(list);
  const scored = list
    .filter(
      (e) =>
        typeof e.resultR === 'number' &&
        typeof e.maxBeforeRetest === 'number' &&
        Number.isFinite(e.maxBeforeRetest) &&
        (e.maxBeforeRetest as number) >= BE_RETEST_MIN_R
    )
    .map((e) => ({
      resultR: e.resultR as number,
      maxBeforeRetest: e.maxBeforeRetest as number,
    }));

  const candidateLevels = BE_CANDIDATE_LEVELS.filter(
    (r) => suggestedTpR == null || r < suggestedTpR
  );

  const levels = candidateLevels.map((levelR) => scoreBeLevel(scored, levelR));

  const eligible = levels.filter(
    (l) =>
      l.triggered >= BE_OUTCOME_MIN_TRIGGERS &&
      l.deltaExpectancy != null
  );

  const bestProtect = [...eligible]
    .filter((l) => (l.deltaExpectancy as number) > 0)
    .sort((a, b) => (b.deltaExpectancy as number) - (a.deltaExpectancy as number))[0];

  if (bestProtect) {
    return {
      withRetestSample: peaks.length,
      medianMaxBeforeRetest: medianOrNull(peaks),
      scoredSample: scored.length,
      levels,
      suggestedBeR: bestProtect.levelR,
      beSource: 'outcome',
      beVerdict: 'protect',
      beDeltaExpectancy: bestProtect.deltaExpectancy,
      hint: `Move to BE after +${bestProtect.levelR}R then retest — saved ${bestProtect.lossesSaved} losses (${bestProtect.savedR}R) vs cut ${bestProtect.winnersCut} winners (${bestProtect.cutR}R); Δ ${bestProtect.deltaExpectancy}R/trade.`,
    };
  }

  if (scored.length >= BE_OUTCOME_MIN_TRIGGERS && eligible.length > 0) {
    const worstCost = [...eligible].sort(
      (a, b) => (b.deltaExpectancy as number) - (a.deltaExpectancy as number)
    )[0];
    return {
      withRetestSample: peaks.length,
      medianMaxBeforeRetest: medianOrNull(peaks),
      scoredSample: scored.length,
      levels,
      suggestedBeR: null,
      beSource: 'outcome',
      beVerdict: 'hold',
      beDeltaExpectancy: worstCost?.deltaExpectancy ?? null,
      hint:
        worstCost != null
          ? `Hold for TP — BE after retest would cut more winners than it saves (best Δ ${worstCost.deltaExpectancy}R/trade at ${worstCost.levelR}R).`
          : 'Hold for TP — BE after retest does not improve expectancy in this sample.',
    };
  }

  // Not enough outcome+retest data — fall back to peak median, then caller may use Max RR
  const fromRetest = suggestedBeFromRetests(peaks, suggestedTpR);
  if (fromRetest != null) {
    return {
      withRetestSample: peaks.length,
      medianMaxBeforeRetest: medianOrNull(peaks),
      scoredSample: scored.length,
      levels,
      suggestedBeR: fromRetest,
      beSource: 'retest',
      beVerdict: 'protect',
      beDeltaExpectancy: null,
      hint: `Peak-before-retest median suggests BE after +${fromRetest}R (need more logged outcomes to confirm protect vs hold).`,
    };
  }

  return {
    withRetestSample: peaks.length,
    medianMaxBeforeRetest: medianOrNull(peaks),
    scoredSample: scored.length,
    levels,
    suggestedBeR: null,
    beSource: null,
    beVerdict: null,
    beDeltaExpectancy: null,
    hint: null,
  };
}

function computeBestTimeSlots(
  events: UnifiedEvent[],
  slotMinutes: TimeSlotMinutes
): BestTimeSlot[] {
  const bySlot = new Map<number, UnifiedEvent[]>();
  for (const e of events) {
    const key = slotStartMinutes(e.minuteOfDay, slotMinutes);
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(e);
  }

  return [...bySlot.entries()]
    .map(([startMin, list]) => {
      const maxes = list
        .map((e) => e.maximumRr)
        .filter((n): n is number => typeof n === 'number');
      const resultRs = list
        .filter((e) => e.source === 'taken' || typeof e.resultR === 'number')
        .map((e) => e.resultR)
        .filter((n): n is number => typeof n === 'number');
      const takenRs = list
        .filter((e) => e.source === 'taken')
        .map((e) => e.resultR)
        .filter((n): n is number => typeof n === 'number');
      const forExp = takenRs.length ? takenRs : resultRs;
      const hitRates = hitRatesForMaxes(maxes);

      return {
        startMin,
        label: slotClockLabel(startMin),
        count: list.length,
        winRate: winRateFromOutcomes(list),
        withMaxSample: maxes.length,
        hitRates,
        suggestedTpR: suggestedTpFromHits(hitRates),
        expectancy: avg(forExp),
      };
    })
    .filter((s) => s.count >= 1)
    .sort((a, b) => a.startMin - b.startMin);
}

function dayKeyFromDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function outcomeFromR(r: number): 'win' | 'loss' | 'be' {
  if (r > 0) return 'win';
  if (r < 0) return 'loss';
  return 'be';
}

function winRateFromOutcomes(events: UnifiedEvent[]) {
  const scored = events.filter((e) => e.outcome === 'win' || e.outcome === 'loss');
  if (!scored.length) return null;
  const wins = scored.filter((e) => e.outcome === 'win').length;
  return Number(((wins / scored.length) * 100).toFixed(1));
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return Number((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(3));
}

function assignSetupIndexes(events: UnifiedEvent[]) {
  const byDay = new Map<string, UnifiedEvent[]>();
  for (const e of events) {
    if (!byDay.has(e.dayKey)) byDay.set(e.dayKey, []);
    byDay.get(e.dayKey)!.push(e);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    list.forEach((e, i) => {
      e.setupIndex = i + 1;
    });
  }
}

async function loadUnifiedEvents(userId: string, source: AnalyticsSource) {
  await migrateLegacyJournal(userId);

  const entries = await JournalEntry.find({ userId }).sort({ date: 1 });
  const taken = entries.filter((e) => e.source === 'taken');
  const notTaken = entries.filter((e) => e.source === 'not_taken');

  const takenEvents: UnifiedEvent[] = taken.map((t) => ({
    source: 'taken' as const,
    at: new Date(t.date),
    dayKey: dayKeyFromDate(new Date(t.date)),
    hour: hourInIst(new Date(t.date)),
    minuteOfDay: minuteOfDayIst(new Date(t.date)),
    setupIndex: 0,
    strategyName: t.strategyName || 'Unassigned',
    maximumRr: t.maximumRr,
    maxBeforeRetest: t.maxBeforeRetest,
    resultR: t.resultR,
    outcome: outcomeFromR(t.resultR ?? 0),
    checklist: t.checklist ?? [],
  }));

  const notTakenEvents: UnifiedEvent[] = notTaken.map((e) => ({
    source: 'not_taken' as const,
    at: new Date(e.date),
    dayKey: dayKeyFromDate(new Date(e.date)),
    hour: hourInIst(new Date(e.date)),
    minuteOfDay: minuteOfDayIst(new Date(e.date)),
    setupIndex: 0,
    strategyName: e.strategyName || 'Unassigned',
    maximumRr: e.maximumRr,
    maxBeforeRetest: e.maxBeforeRetest,
    resultR: e.resultR,
    outcome:
      typeof e.resultR === 'number'
        ? outcomeFromR(e.resultR)
        : e.outcome ?? 'unknown',
    checklist: e.checklist ?? [],
  }));

  let events: UnifiedEvent[] = [];
  if (source === 'taken') events = [...takenEvents];
  else if (source === 'not_taken') events = [...notTakenEvents];
  else events = [...takenEvents, ...notTakenEvents];

  assignSetupIndexes(events);
  assignSetupIndexes(takenEvents);

  return { events, takenEvents, notTakenEvents, taken, notTaken };
}

function metricsForEvents(list: UnifiedEvent[]) {
  const maxes = list
    .map((e) => e.maximumRr)
    .filter((n): n is number => typeof n === 'number');
  const takenRs = list
    .filter((e) => e.source === 'taken')
    .map((e) => e.resultR)
    .filter((n): n is number => typeof n === 'number');
  const hitRates = hitRatesForMaxes(maxes);
  const suggestedTpR = suggestedTpFromHits(hitRates);
  const be = analyzeBeFromOutcomes(list, suggestedTpR);
  const fallbackBe = suggestedBeFromHits(hitRates, suggestedTpR);

  let suggestedBeR = be.suggestedBeR;
  let beSource: BeSource = be.beSource;
  let beVerdict: BeVerdict = be.beVerdict;
  let hint = be.hint;
  let beDeltaExpectancy = be.beDeltaExpectancy;

  if (be.beSource == null && fallbackBe != null) {
    suggestedBeR = fallbackBe;
    beSource = 'max_rr_fallback';
    beVerdict = 'protect';
    beDeltaExpectancy = null;
    hint = `Max RR fallback — BE after +${fallbackBe}R (log maxBeforeRetest + results for protect vs hold).`;
  }

  const asTrades = list
    .filter((e) => e.source === 'taken' && e.checklist?.length)
    .map(
      (e) =>
        ({
          resultR: e.resultR ?? 0,
          checklist: e.checklist,
        }) as ITrade
    );

  return {
    count: list.length,
    winRate: winRateFromOutcomes(list),
    expectancy: avg(takenRs.length ? takenRs : list.map((e) => e.resultR).filter((n): n is number => typeof n === 'number')),
    withMaxSample: maxes.length,
    hitRates,
    suggestedTpR,
    suggestedBeR,
    withRetestSample: be.withRetestSample,
    medianMaxBeforeRetest: be.medianMaxBeforeRetest,
    beScoredSample: be.scoredSample,
    beLevels: be.levels,
    beSource,
    beVerdict,
    beDeltaExpectancy,
    beHint: hint,
    checklistImpact: computeChecklistImpact(asTrades),
  };
}

export async function getPlaybook(
  userId: string,
  opts: {
    source?: AnalyticsSource;
    slotMinutes?: TimeSlotMinutes;
    /** null / omit = all times */
    startMin?: number | null;
    /** null / omit = all setup # */
    setupIndex?: number | null;
  } = {}
) {
  const source = opts.source ?? 'combined';
  const slotMinutes = (opts.slotMinutes ?? 30) as TimeSlotMinutes;
  const startMinFilter =
    opts.startMin === undefined || opts.startMin === null
      ? null
      : Number(opts.startMin);
  const setupFilter =
    opts.setupIndex === undefined || opts.setupIndex === null
      ? null
      : Number(opts.setupIndex);

  const { events } = await loadUnifiedEvents(userId, source);

  const timeOptions = computeBestTimeSlots(events, slotMinutes).map((s) => ({
    startMin: s.startMin,
    label: s.label,
    count: s.count,
  }));

  const bySetup = new Map<number, number>();
  for (const e of events) {
    bySetup.set(e.setupIndex, (bySetup.get(e.setupIndex) ?? 0) + 1);
  }
  const setupOptions = [...bySetup.entries()]
    .map(([setupIndex, count]) => ({ setupIndex, count }))
    .sort((a, b) => a.setupIndex - b.setupIndex);

  let slice = events;
  if (startMinFilter != null && Number.isFinite(startMinFilter)) {
    slice = slice.filter(
      (e) => slotStartMinutes(e.minuteOfDay, slotMinutes) === startMinFilter
    );
  }
  if (setupFilter != null && Number.isFinite(setupFilter)) {
    slice = slice.filter((e) => e.setupIndex === setupFilter);
  }

  const metrics = metricsForEvents(slice);

  // Cross-breakdown helpers inside current filters
  let setupBreakdown: Array<{
    setupIndex: number;
    count: number;
    winRate: number | null;
    expectancy: number | null;
    suggestedTpR: number | null;
  }> = [];
  let timeBreakdown: Array<{
    startMin: number;
    label: string;
    count: number;
    winRate: number | null;
    expectancy: number | null;
    suggestedTpR: number | null;
  }> = [];

  if (setupFilter == null) {
    const map = new Map<number, UnifiedEvent[]>();
    for (const e of slice) {
      if (!map.has(e.setupIndex)) map.set(e.setupIndex, []);
      map.get(e.setupIndex)!.push(e);
    }
    setupBreakdown = [...map.entries()]
      .map(([setupIndex, list]) => {
        const m = metricsForEvents(list);
        return {
          setupIndex,
          count: m.count,
          winRate: m.winRate,
          expectancy: m.expectancy,
          suggestedTpR: m.suggestedTpR,
        };
      })
      .sort((a, b) => a.setupIndex - b.setupIndex);
  }

  if (startMinFilter == null) {
    timeBreakdown = computeBestTimeSlots(slice, slotMinutes).map((s) => ({
      startMin: s.startMin,
      label: s.label,
      count: s.count,
      winRate: s.winRate,
      expectancy: s.expectancy,
      suggestedTpR: s.suggestedTpR,
    }));
  }

  return {
    source,
    filters: {
      slotMinutes,
      startMin: startMinFilter,
      setupIndex: setupFilter,
      timeLabel:
        startMinFilter == null ? 'All times' : slotClockLabel(startMinFilter),
      setupLabel:
        setupFilter == null ? 'All setups' : `#${setupFilter} of day`,
    },
    options: {
      times: timeOptions,
      setupIndexes: setupOptions,
    },
    slice: {
      ...metrics,
      note:
        metrics.count < 5
          ? 'Small sample — treat TP/BE and rule cuts as tentative.'
          : null,
    },
    setupBreakdown,
    timeBreakdown,
  };
}

export async function getUnifiedInsights(
  userId: string,
  source: AnalyticsSource = 'combined'
) {
  const { events, takenEvents, notTakenEvents, taken } = await loadUnifiedEvents(
    userId,
    source
  );

  const withMax = events.filter((e) => typeof e.maximumRr === 'number');
  const takenWithBoth = events.filter(
    (e) =>
      e.source === 'taken' &&
      typeof e.maximumRr === 'number' &&
      typeof e.resultR === 'number' &&
      (e.maximumRr as number) > 0
  );

  const captureRates = takenWithBoth.map(
    (e) => ((e.resultR as number) / (e.maximumRr as number)) * 100
  );

  const takenByDay = new Map<string, UnifiedEvent[]>();
  for (const e of takenEvents) {
    if (!takenByDay.has(e.dayKey)) takenByDay.set(e.dayKey, []);
    takenByDay.get(e.dayKey)!.push(e);
  }
  let afterWinSecondN = 0;
  let afterWinSecondWins = 0;
  let afterLossSecondN = 0;
  let afterLossSecondWins = 0;
  for (const list of takenByDay.values()) {
    const sorted = [...list].sort((a, b) => a.at.getTime() - b.at.getTime());
    if (sorted.length < 2) continue;
    const first = sorted[0];
    const second = sorted[1];
    if (first.outcome === 'win') {
      afterWinSecondN += 1;
      if (second.outcome === 'win') afterWinSecondWins += 1;
    } else if (first.outcome === 'loss') {
      afterLossSecondN += 1;
      if (second.outcome === 'win') afterLossSecondWins += 1;
    }
  }

  const byIndex = new Map<number, UnifiedEvent[]>();
  for (const e of events) {
    if (!byIndex.has(e.setupIndex)) byIndex.set(e.setupIndex, []);
    byIndex.get(e.setupIndex)!.push(e);
  }
  const setupIndexBuckets = [...byIndex.entries()]
    .map(([setupIndex, list]) => ({
      setupIndex,
      count: list.length,
      takenCount: list.filter((e) => e.source === 'taken').length,
      notTakenCount: list.filter((e) => e.source === 'not_taken').length,
      winRate: winRateFromOutcomes(list),
      avgMaxRr: avg(
        list
          .map((e) => e.maximumRr)
          .filter((n): n is number => typeof n === 'number')
      ),
      avgResultR: avg(
        list
          .filter((e) => e.source === 'taken')
          .map((e) => e.resultR)
          .filter((n): n is number => typeof n === 'number')
      ),
    }))
    .sort((a, b) => a.setupIndex - b.setupIndex);

  const takenScored = events.filter(
    (e) => e.source === 'taken' && (e.outcome === 'win' || e.outcome === 'loss')
  );

  const bestTimes = {
    slots15: computeBestTimeSlots(events, 15),
    slots30: computeBestTimeSlots(events, 30),
    slots60: computeBestTimeSlots(events, 60),
  };

  // Best clock time by expectancy among slots with enough sample (30m grid)
  const ranked30 = [...bestTimes.slots30]
    .filter((s) => s.count >= 3 && s.expectancy != null)
    .sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity));
  const bestSlot = ranked30[0]
    ? {
        label: ranked30[0].label,
        count: ranked30[0].count,
        winRate: ranked30[0].winRate,
        suggestedTpR: ranked30[0].suggestedTpR,
        hitRates: ranked30[0].hitRates,
        expectancy: ranked30[0].expectancy,
      }
    : null;

  const overallMetrics = metricsForEvents(events);

  return {
    source,
    counts: {
      taken: takenEvents.length,
      notTaken: notTakenEvents.length,
      combined: takenEvents.length + notTakenEvents.length,
      filtered: events.length,
    },
    summary: {
      winRate: winRateFromOutcomes(events),
      avgMaxRr: avg(withMax.map((e) => e.maximumRr as number)),
      avgResultR: avg(
        events
          .filter((e) => e.source === 'taken')
          .map((e) => e.resultR)
          .filter((n): n is number => typeof n === 'number')
      ),
      avgCapturePct: avg(captureRates),
      takenWithMaxRr: takenWithBoth.length,
      scoredSample: takenScored.length,
    },
    recommendedTpR: overallMetrics.suggestedTpR,
    recommendedBeR: overallMetrics.suggestedBeR,
    beSource: overallMetrics.beSource,
    beVerdict: overallMetrics.beVerdict,
    beDeltaExpectancy: overallMetrics.beDeltaExpectancy,
    beHint: overallMetrics.beHint,
    retestBe: {
      sample: overallMetrics.withRetestSample,
      scoredSample: overallMetrics.beScoredSample,
      medianMaxBeforeRetest: overallMetrics.medianMaxBeforeRetest,
      levels: overallMetrics.beLevels,
      suggestedBeR: overallMetrics.suggestedBeR,
      beVerdict: overallMetrics.beVerdict,
      beDeltaExpectancy: overallMetrics.beDeltaExpectancy,
      minPeakR: BE_RETEST_MIN_R,
      note:
        'BE counterfactual: if maxBeforeRetest ≥ level then flatten at 0R. Losses saved vs winners cut → protect if ΔR/trade > 0, else hold for TP.',
    },
    bestTimes,
    bestSlot,
    sequence: {
      afterFirstWin: {
        secondTradeCount: afterWinSecondN,
        secondTradeWinRate:
          afterWinSecondN === 0
            ? null
            : Number(((afterWinSecondWins / afterWinSecondN) * 100).toFixed(1)),
      },
      afterFirstLoss: {
        secondTradeCount: afterLossSecondN,
        secondTradeWinRate:
          afterLossSecondN === 0
            ? null
            : Number(((afterLossSecondWins / afterLossSecondN) * 100).toFixed(1)),
      },
      insight:
        'If the 2nd trade after a first win is weak, consider stopping after the first win.',
    },
    setupIndexBuckets,
    checklistImpact:
      source === 'not_taken'
        ? []
        : computeChecklistImpact(taken as unknown as ITrade[]),
  };
}
