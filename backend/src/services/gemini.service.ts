import { env } from '../config/env';
import { AppError } from '../types';
import {
  getUnifiedInsights,
  type AnalyticsSource,
  type BestTimeSlot,
} from './analytics.service';

const SYSTEM_PROMPT = `You are a trading-journal coach for discretionary traders.
You ONLY use the JSON provided. Do not invent trades or numbers.

Your jobs (in order):
1) Recommend concrete **Take Profit (TP)** and **Breakeven (BE)** levels in R.
   - TP from Max RR hit rates (how far price typically ran).
   - BE from outcome counterfactuals in retestBe when present:
     • beVerdict "protect" + recommendedBeR = move stop to BE after that run then retest (saved losses beat cut winners; ΔR/trade > 0).
     • beVerdict "hold" = do NOT move to BE early — winners after retest outweigh stops saved; hold toward TP.
   - Prefer beSource "outcome" over "retest" or "max_rr_fallback".
2) Audit **every checklist rule** using checklistRuleAudit (verdict keep/review/cut/needs_data). List rules to CUT or demote so the trader does not miss good setups. Do not only discuss one example rule — cover all ready verdicts.
3) Best IST clock times, avg R, and whether to take a 2nd trade.
   - sequence uses the current source filter (combined = taken + not_taken setups that day).
   - If afterFirstWin.secondTradeCount is 0, say insufficient data — do not invent caution from an empty sample.

Hit-rate / retest reading:
- pct at ≥XR (Max RR) = share of trades whose peak reached at least X — use for TP fill likelihood.
- maxBeforeRetest = max R before price first returned to entry. Peaks below 0.5R are noise.
- retestBe.levels: for each BE level, lossesSaved vs winnersCut and deltaExpectancy if flattened at 0R after retest.
- Prefer TP with solid fill (≥50–60% hits).

Checklist verdicts:
- keep = required (checked trades clearly better expectancy)
- cut = remove from required list (without is same/better)
- review = weak edge — optional / redefine
- needs_data = keep logging checked AND unchecked

Required markdown structure:
## Recommended TP & BE
## Checklist rule audit
## Best times
## 2nd trade
## Caveats
## Next experiment

Be concise. Short bullets. Frame as journal observations, not financial advice.`;

const COACH_CHAT_PROMPT = `You are a trading-journal strategy coach for discretionary traders.
You ONLY use the journal analytics JSON attached below (and the conversation). Do not invent trades, win rates, or R numbers.

Goals:
- Help the trader improve their written strategy: TP/BE, checklist rules (keep/cut/review), best IST times, 2nd-setup-of-day rules.
- Answer the trader's question directly. Be concrete and actionable.
- When sample sizes are small (counts or secondTradeCount near 0), say so — do not invent caution or edge from empty data.
- Prefer short markdown: bullets, bold key levels (e.g. **1.5R**). No long essays.
- Frame as journal observations, not financial advice or trade signals.

Hit-rate / checklist reading (same as analytics):
- pct at ≥XR = Max RR reached that level — use for TP fill likelihood.
- beVerdict protect = move to BE after that run then retest; hold = do not BE early.
- checklist: keep / cut / review / needs_data.
- maxBeforeRetest / retestPeaks[0] = peak before 1st return to entry; retestCount = # of retests; retestPeaks[i] = peak before (i+1)th retest; maxAfterFirstRetest = retestPeaks[1].
- retestContinuation.afterFirstRetest = stats after 1st retest (did price run further toward TP?).
- secondLegBe = BE counterfactual on 2nd leg using peak before 2nd retest.`;

function compactSlots(slots: BestTimeSlot[], limit = 12) {
  return slots
    .filter((s) => s.count >= 2)
    .slice(0, 40)
    .sort((a, b) => (b.expectancy ?? -999) - (a.expectancy ?? -999))
    .slice(0, limit)
    .map((s) => ({
      time: s.label,
      trades: s.count,
      withMaxSample: s.withMaxSample,
      winRate: s.winRate,
      suggestedTpR: s.suggestedTpR,
      hitPct: Object.fromEntries(s.hitRates.map((h) => [h.label, h.pct])),
      avgR: s.expectancy,
    }));
}

/** Aggregate Max RR hit rates across slots (each trade is in one slot). */
function overallHitRates(slots: BestTimeSlot[]) {
  const byThreshold = new Map<number, { hits: number; sample: number }>();

  for (const s of slots) {
    for (const h of s.hitRates) {
      const row = byThreshold.get(h.thresholdR) ?? { hits: 0, sample: 0 };
      row.hits += h.count;
      row.sample += s.withMaxSample;
      byThreshold.set(h.thresholdR, row);
    }
  }

  return [...byThreshold.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([thresholdR, { hits, sample }]) => ({
      thresholdR,
      label: `≥${thresholdR}R`,
      hits,
      sample,
      pct: sample === 0 ? null : Number(((hits / sample) * 100).toFixed(1)),
    }));
}

/**
 * TP: highest level with hit ≥60% (fills often).
 * BE: highest level with hit ≥70% that is still < TP (or ≤1.2 if no TP).
 */
function recommendTpAndBe(
  hitRates: Array<{ thresholdR: number; pct: number | null }>
) {
  let recommendedTpR: number | null = null;
  for (const h of hitRates) {
    if (h.pct != null && h.pct >= 60) recommendedTpR = h.thresholdR;
  }

  let recommendedBeR: number | null = null;
  for (const h of hitRates) {
    if (h.pct == null || h.pct < 70) continue;
    if (recommendedTpR != null && h.thresholdR >= recommendedTpR) continue;
    recommendedBeR = h.thresholdR;
  }

  // Fallback BE: one step under TP among common levels
  if (recommendedBeR == null && recommendedTpR != null) {
    const below = hitRates
      .map((h) => h.thresholdR)
      .filter((r) => r < recommendedTpR!)
      .sort((a, b) => b - a);
    recommendedBeR = below[0] ?? null;
  }

  return { recommendedTpR, recommendedBeR };
}

function buildPayload(insights: Awaited<ReturnType<typeof getUnifiedInsights>>) {
  const slots30 = insights.bestTimes.slots30;
  const overallHits = overallHitRates(slots30);
  const recommendedTpR = insights.recommendedTpR ?? recommendTpAndBe(overallHits).recommendedTpR;
  const recommendedBeR =
    insights.beVerdict === 'hold'
      ? null
      : (insights.recommendedBeR ?? recommendTpAndBe(overallHits).recommendedBeR);

  const beMeaning =
    insights.beVerdict === 'hold'
      ? insights.beHint ??
        'Hold for TP — moving to BE after retest would cut more winners than it saves.'
      : recommendedBeR == null
        ? null
        : insights.beSource === 'outcome'
          ? `Protect: after +${recommendedBeR}R then retest of entry, move stop to BE (Δ ${insights.beDeltaExpectancy ?? '?'}R/trade vs no BE).`
          : insights.beSource === 'retest'
            ? `After price reaches +${recommendedBeR}R before retesting entry, consider moving stop to breakeven (peak-based; log more for outcome score).`
            : `After price reaches +${recommendedBeR}R (Max RR fallback — log maxBeforeRetest for protect vs hold), consider moving stop to breakeven.`;

  return {
    source: insights.source,
    counts: insights.counts,
    summary: insights.summary,
    howToReadHitRates:
      'pct at ≥XR = share of trades whose Max RR reached at least X. Use for TP fill likelihood.',
    howToReadRetestBe:
      'Counterfactual BE: if maxBeforeRetest ≥ level, flatten at 0R. protect if ΔR/trade > 0; hold if winners after retest dominate.',
    overallMaxRrHitRates: overallHits,
    retestBe: insights.retestBe,
    beSource: insights.beSource,
    beVerdict: insights.beVerdict,
    beDeltaExpectancy: insights.beDeltaExpectancy,
    beHint: insights.beHint,
    recommendedTpR,
    recommendedBeR,
    recommendedBeMeaning: beMeaning,
    recommendedTpMeaning:
      recommendedTpR == null
        ? null
        : `Consider a take-profit near +${recommendedTpR}R — Max RR reached that level often enough in this sample.`,
    bestSlot: insights.bestSlot,
    topSlots30mByAvgR: compactSlots(slots30),
    sequence: insights.sequence,
    retestContinuation: insights.retestContinuation,
    secondLegBe: insights.secondLegBe,
    checklistRuleAudit: {
      howToRead:
        'Audit EVERY checklist item. cut = remove required rule; keep = keep required; review = optional; needs_data = log more mixed answers.',
      rules: insights.checklistImpact.map((r) => ({
        category: r.categoryName,
        item: r.itemLabel,
        verdict: r.verdict,
        deltaExpectancyR: r.deltaExpectancy,
        with: { n: r.withCount, wr: r.withWinRate, avgR: r.withExpectancy },
        without: { n: r.withoutCount, wr: r.withoutWinRate, avgR: r.withoutExpectancy },
        hint: r.verdictHint,
      })),
      toCut: insights.checklistImpact
        .filter((r) => r.verdict === 'cut')
        .map((r) => r.itemLabel),
      toKeep: insights.checklistImpact
        .filter((r) => r.verdict === 'keep')
        .map((r) => r.itemLabel),
      needsMoreData: insights.checklistImpact
        .filter((r) => r.verdict === 'needs_data')
        .map((r) => r.itemLabel),
    },
    setupIndex: insights.setupIndexBuckets.slice(0, 5).map((b) => ({
      n: b.setupIndex,
      count: b.count,
      winRate: b.winRate,
      avgR: b.avgResultR,
      avgMax: b.avgMaxRr,
    })),
  };
}

type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

async function callGemini(
  contents: GeminiContent[],
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }
): Promise<string> {
  if (!env.geminiApiKey) {
    throw new AppError(
      'Gemini is not configured. Set GEMINI_API_KEY on the API.',
      503
    );
  }

  const model = env.geminiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options?.systemPrompt ?? SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.35,
        maxOutputTokens: options?.maxOutputTokens ?? 1600,
      },
    }),
  });

  const body = (await res.json()) as {
    error?: { message?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  if (!res.ok) {
    throw new AppError(
      body.error?.message || `Gemini request failed (${res.status})`,
      502
    );
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new AppError('Gemini returned an empty response', 502);
  }

  return text;
}

export async function generateAiInsights(
  userId: string,
  source: AnalyticsSource = 'combined'
) {
  const insights = await getUnifiedInsights(userId, source);
  const payload = buildPayload(insights);

  if (insights.counts.filtered < 3) {
    return {
      markdown:
        'Not enough journal data yet (need a few more trades with times and Max RR). Keep logging — then AI insights will be meaningful.',
      model: env.geminiModel,
      usedGemini: false,
      sample: insights.counts.filtered,
    };
  }

  const userContent = `Journal analytics JSON (IST). Lead with TP (Max RR) and BE (prefer outcome protect vs hold from retestBe):\n\n${JSON.stringify(payload)}`;
  const markdown = await callGemini([
    { role: 'user', parts: [{ text: userContent }] },
  ]);

  return {
    markdown,
    model: env.geminiModel,
    usedGemini: true,
    sample: insights.counts.filtered,
    recommendedTpR: payload.recommendedTpR,
    recommendedBeR: payload.recommendedBeR,
    beVerdict: payload.beVerdict,
  };
}

export type CoachChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_HISTORY = 16;

export async function coachChat(
  userId: string,
  input: {
    message: string;
    source?: AnalyticsSource;
    history?: CoachChatMessage[];
  }
) {
  const source = input.source ?? 'combined';
  const message = input.message.trim();
  if (!message) {
    throw new AppError('Message is required', 400);
  }

  const insights = await getUnifiedInsights(userId, source);
  const payload = buildPayload(insights);

  const history = (input.history ?? [])
    .filter((m) => m.content.trim())
    .slice(-MAX_HISTORY);

  const systemPrompt = `${COACH_CHAT_PROMPT}

## Journal analytics context (IST, source=${source})
Use this JSON as ground truth. Sample size: ${insights.counts.filtered} events.

${JSON.stringify(payload)}`;

  const contents: GeminiContent[] = [];
  for (const m of history) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  // Gemini requires the first content role to be user
  if (contents[0]?.role === 'model') {
    contents.unshift({
      role: 'user',
      parts: [{ text: '(continuing strategy discussion)' }],
    });
  }

  const reply = await callGemini(contents, {
    systemPrompt,
    temperature: 0.45,
    maxOutputTokens: 1200,
  });

  return {
    reply,
    model: env.geminiModel,
    sample: insights.counts.filtered,
    source,
  };
}
