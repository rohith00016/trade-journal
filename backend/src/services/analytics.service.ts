import { JournalEntry } from '../models';
import { ITrade } from '../models/Trade';
import { migrateLegacyJournal } from './journal.service';

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

function hourLabelIst(hour: number) {
  const start = String(hour).padStart(2, '0');
  const end = String((hour + 1) % 24).padStart(2, '0');
  return `${start}:00–${end}:00 IST`;
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

      return {
        categoryName,
        itemLabel: value.itemLabel,
        withCount: value.withChecked.length,
        withoutCount: value.withoutChecked.length,
        withWinRate: Number(withWinRate.toFixed(1)),
        withoutWinRate: Number(withoutWinRate.toFixed(1)),
        withExpectancy: expectancy(value.withChecked),
        withoutExpectancy: expectancy(value.withoutChecked),
        deltaWinRate: Number((withWinRate - withoutWinRate).toFixed(1)),
        deltaExpectancy: Number(
          (expectancy(value.withChecked) - expectancy(value.withoutChecked)).toFixed(3)
        ),
      };
    })
    .filter((r) => r.withCount >= 3 && r.withoutCount >= 3)
    .sort((a, b) => b.deltaExpectancy - a.deltaExpectancy);
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
  };
}

export type AnalyticsSource = 'taken' | 'not_taken' | 'combined';

type UnifiedEvent = {
  source: 'taken' | 'not_taken';
  at: Date;
  dayKey: string;
  hour: number;
  setupIndex: number;
  strategyName: string;
  maximumRr?: number;
  resultR?: number;
  outcome?: 'win' | 'loss' | 'be' | 'unknown';
};

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

export async function getUnifiedInsights(
  userId: string,
  source: AnalyticsSource = 'combined'
) {
  await migrateLegacyJournal(userId);

  const entries = await JournalEntry.find({ userId }).sort({ date: 1 });
  const taken = entries.filter((e) => e.source === 'taken');
  const notTaken = entries.filter((e) => e.source === 'not_taken');

  const takenEvents: UnifiedEvent[] = taken.map((t) => ({
    source: 'taken' as const,
    at: new Date(t.date),
    dayKey: dayKeyFromDate(new Date(t.date)),
    hour: hourInIst(new Date(t.date)),
    setupIndex: 0,
    strategyName: t.strategyName || 'Unassigned',
    maximumRr: t.maximumRr,
    resultR: t.resultR,
    outcome: outcomeFromR(t.resultR ?? 0),
  }));

  const notTakenEvents: UnifiedEvent[] = notTaken.map((e) => ({
    source: 'not_taken' as const,
    at: new Date(e.date),
    dayKey: dayKeyFromDate(new Date(e.date)),
    hour: hourInIst(new Date(e.date)),    setupIndex: 0,
    strategyName: e.strategyName || 'Unassigned',
    maximumRr: e.maximumRr,
    resultR: e.resultR,
    outcome:
      typeof e.resultR === 'number'
        ? outcomeFromR(e.resultR)
        : e.outcome ?? 'unknown',
  }));

  let events: UnifiedEvent[] = [];
  if (source === 'taken') events = [...takenEvents];
  else if (source === 'not_taken') events = [...notTakenEvents];
  else events = [...takenEvents, ...notTakenEvents];

  assignSetupIndexes(events);

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

  const byHour = new Map<number, UnifiedEvent[]>();
  for (const e of events) {
    if (!byHour.has(e.hour)) byHour.set(e.hour, []);
    byHour.get(e.hour)!.push(e);
  }
  const hourBuckets = [...byHour.entries()]
    .map(([hour, list]) => {
      const scored = list.filter((e) => e.outcome === 'win' || e.outcome === 'loss');
      return {
        hour,
        label: hourLabelIst(hour),
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
        sampleForWinRate: scored.length,
      };
    })
    .filter((b) => b.count >= 1)
    .sort((a, b) => a.hour - b.hour);

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
    rrGap: {
      avgMaxRr: avg(withMax.map((e) => e.maximumRr as number)),
      avgRealizedR: avg(takenWithBoth.map((e) => e.resultR as number)),
      avgCapturePct: avg(captureRates),
      sample: takenWithBoth.length,
      note:
        'When Max RR is higher than realized R on taken trades, you’re leaving potential R on the table (or Max RR is optimistic).',
    },
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
        'If win rate of the 2nd taken trade after a first win is weak, consider a “stop after first win” rule.',
    },
    hourBuckets,
    setupIndexBuckets,
    checklistImpact:
      source === 'not_taken'
        ? []
        : computeChecklistImpact(taken as unknown as ITrade[]),
  };
}
