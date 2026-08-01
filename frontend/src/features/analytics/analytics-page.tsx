import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAiInsights, useInsights } from '@/lib/hooks'
import type { BestTimeSlot, InsightsSource } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { formatR, cn } from '@/lib/utils'
import { CoachChat } from './coach-chat'

const SOURCES: { id: InsightsSource; label: string }[] = [
  { id: 'combined', label: 'Combined' },
  { id: 'taken', label: 'Taken' },
  { id: 'not_taken', label: 'Not taken' },
]

type SlotSize = 15 | 30 | 60

const SLOT_OPTIONS: { id: SlotSize; label: string }[] = [
  { id: 15, label: '15 min' },
  { id: 30, label: '30 min' },
  { id: 60, label: '1 hour' },
]

function fmt(n: number | null | undefined, suffix = '', digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Number(n).toFixed(digits)}${suffix}`
}

export function AnalyticsPage() {
  const [source, setSource] = useState<InsightsSource>('combined')
  const [slotSize, setSlotSize] = useState<SlotSize>(30)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiLevels, setAiLevels] = useState<{
    tp: number | null
    be: number | null
    beVerdict: 'protect' | 'hold' | null
  } | null>(null)
  const { data, isLoading } = useInsights(source)
  const ai = useAiInsights()

  const slots = useMemo(() => {
    if (!data) return [] as BestTimeSlot[]
    if (slotSize === 15) return data.bestTimes.slots15
    if (slotSize === 60) return data.bestTimes.slots60
    return data.bestTimes.slots30
  }, [data, slotSize])

  const bestLabel = data?.bestSlot?.label

  async function onExplain() {
    try {
      const result = await ai.mutateAsync(source)
      setAiText(result.markdown)
      setAiLevels({
        tp: result.recommendedTpR ?? null,
        be: result.recommendedBeR ?? null,
        beVerdict: result.beVerdict ?? null,
      })
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not generate AI insights'
      )
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Global best times, 2nd-trade rules, and checklist impact. Combined slices live under{' '}
            <Link to="/playbook" className="underline underline-offset-2 hover:text-foreground">
              Playbook
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={ai.isPending}
            onClick={() => void onExplain()}
          >
            {ai.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Explain my edge
          </Button>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 p-1">
            {SOURCES.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={source === s.id ? 'default' : 'ghost'}
                onClick={() => {
                  setSource(s.id)
                  setAiText(null)
                  setAiLevels(null)
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {aiText ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4" />
              AI summary
            </CardTitle>
            <CardDescription>
              From your aggregated stats (times, hit rates, avg R, 2nd trade). Verify against the
              tables — not a signal feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiLevels &&
            (aiLevels.tp != null || aiLevels.be != null || aiLevels.beVerdict === 'hold') ? (
              <div className="flex flex-wrap gap-3">
                {aiLevels.tp != null ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Suggested TP
                    </p>
                    <p className="font-mono text-xl font-semibold">{aiLevels.tp}R</p>
                    <p className="text-[11px] text-muted-foreground">
                      Max often reaches this (fill target)
                    </p>
                  </div>
                ) : null}
                {aiLevels.beVerdict === 'hold' ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      BE rule
                    </p>
                    <p className="font-mono text-xl font-semibold">Hold</p>
                    <p className="text-[11px] text-muted-foreground">
                      After retest, winners beat stops saved — hold for TP
                    </p>
                  </div>
                ) : aiLevels.be != null ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Suggested BE after
                    </p>
                    <p className="font-mono text-xl font-semibold">{aiLevels.be}R</p>
                    <p className="text-[11px] text-muted-foreground">
                      Protect: move stop to BE after this run then retest
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              className={cn(
                'text-sm leading-relaxed text-foreground/90',
                '[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold',
                '[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold',
                '[&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold',
                '[&_p]:mb-2 [&_p]:last:mb-0',
                '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
                '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
                '[&_li]:leading-relaxed',
                '[&_strong]:font-semibold [&_strong]:text-foreground',
                '[&_em]:italic'
              )}
            >
              <ReactMarkdown>{aiText}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CoachChat source={source} />

      {data.bestSlot ? (
        <Card className="border-border/80 bg-muted/10">
          <CardHeader className="pb-2">
            <CardDescription>Best time so far (30 min · ≥3 trades · by avg R)</CardDescription>
            <CardTitle className="font-mono text-3xl tracking-tight">
              {data.bestSlot.label} IST
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <span>
              WR <span className="font-mono">{fmt(data.bestSlot.winRate, '%', 0)}</span>
            </span>
            <span>
              Suggested TP{' '}
              <span className="font-mono">
                {data.bestSlot.suggestedTpR != null
                  ? `${data.bestSlot.suggestedTpR}R`
                  : '—'}
              </span>
              <span className="text-muted-foreground"> (≥60% hit)</span>
            </span>
            <span>
              Avg R <span className="font-mono">{fmt(data.bestSlot.expectancy, 'R', 2)}</span>
            </span>
            <span className="text-muted-foreground">{data.bestSlot.count} trades</span>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Log a few trades with times + Max RR to see best slots and a TP that fills often.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Best times (IST)</CardTitle>
            <CardDescription>
              Hit % = how often Max RR reached that level — use a high % as your TP. Suggested TP =
              highest of 1 / 1.2 / 1.5 / 2R with ≥60% hits.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 p-1">
            {SLOT_OPTIONS.map((o) => (
              <Button
                key={o.id}
                type="button"
                size="sm"
                variant={slotSize === o.id ? 'default' : 'ghost'}
                onClick={() => setSlotSize(o.id)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <Empty hint="No events yet — journal trades with the correct entry time and Max RR." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Time</th>
                    <th className="pb-2 pr-3 font-medium">Trades</th>
                    <th className="pb-2 pr-3 font-medium">Win rate</th>
                    <th className="pb-2 pr-3 font-medium">≥1R</th>
                    <th className="pb-2 pr-3 font-medium">≥1.2R</th>
                    <th className="pb-2 pr-3 font-medium">≥1.5R</th>
                    <th className="pb-2 pr-3 font-medium">≥2R</th>
                    <th className="pb-2 pr-3 font-medium">TP?</th>
                    <th className="pb-2 font-medium">Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => {
                    const isBest =
                      slotSize === 30 && bestLabel != null && s.label === bestLabel
                    const pct = (threshold: number) =>
                      s.hitRates.find((h) => h.thresholdR === threshold)?.pct ?? null
                    return (
                      <tr
                        key={s.startMin}
                        className={cn(
                          'border-b border-border/40',
                          isBest && 'bg-muted/25'
                        )}
                      >
                        <td className="py-2.5 pr-3 font-mono text-base font-medium">
                          {s.label}
                          {isBest ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              best
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{s.count}</td>
                        <td className="py-2.5 pr-3 font-mono">{fmt(s.winRate, '%', 0)}</td>
                        <td className="py-2.5 pr-3 font-mono">{fmt(pct(1), '%', 0)}</td>
                        <td className="py-2.5 pr-3 font-mono">{fmt(pct(1.2), '%', 0)}</td>
                        <td className="py-2.5 pr-3 font-mono">{fmt(pct(1.5), '%', 0)}</td>
                        <td className="py-2.5 pr-3 font-mono">{fmt(pct(2), '%', 0)}</td>
                        <td className="py-2.5 pr-3 font-mono font-medium">
                          {s.suggestedTpR != null ? `${s.suggestedTpR}R` : '—'}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 font-mono',
                            (s.expectancy ?? 0) > 0
                              ? 'text-profit'
                              : (s.expectancy ?? 0) < 0
                                ? 'text-loss'
                                : undefined
                          )}
                        >
                          {fmt(s.expectancy, 'R', 2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2nd setup of the day?</CardTitle>
          <CardDescription>{data.sequence.insight}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <SequenceCard
              title="After first win"
              count={data.sequence.afterFirstWin.secondTradeCount}
              winRate={data.sequence.afterFirstWin.secondTradeWinRate}
            />
            <SequenceCard
              title="After first loss"
              count={data.sequence.afterFirstLoss.secondTradeCount}
              winRate={data.sequence.afterFirstLoss.secondTradeWinRate}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1st vs 2nd vs 3rd setup</CardTitle>
          <CardDescription>Does later-in-day setups underperform?</CardDescription>
        </CardHeader>
        <CardContent>
          {data.setupIndexBuckets.length === 0 ? (
            <Empty hint="No events yet." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.setupIndexBuckets.map((b) => (
                <div
                  key={b.setupIndex}
                  className="rounded-xl border border-border/70 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    #{b.setupIndex} of day
                  </p>
                  <p className="mt-1 font-mono text-2xl">{b.count}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {b.takenCount} taken · {b.notTakenCount} not taken
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    WR {fmt(b.winRate, '%', 0)} · Max {fmt(b.avgMaxRr, 'R', 2)} · R{' '}
                    {fmt(b.avgResultR, 'R', 2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rule audit (every checklist item)</CardTitle>
          <CardDescription>
            Compare expectancy when each box is checked vs unchecked. Cut rules that don’t help so
            you don’t miss good trades. Edit the strategy checklist after you decide.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {source === 'not_taken' ? (
            <Empty hint="Switch to Taken or Combined — rule audit uses taken-trade checklists." />
          ) : data.checklistImpact.length === 0 ? (
            <Empty hint="Log taken trades with strategy checklists (check some items, leave others unchecked) to audit every rule." />
          ) : (
            <div className="space-y-3">
              {data.checklistImpact.map((row) => (
                <div
                  key={`${row.categoryName}-${row.itemLabel}`}
                  className="grid gap-3 rounded-xl border border-border/70 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <VerdictBadge verdict={row.verdict} />
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {row.categoryName}
                      </p>
                    </div>
                    <p className="font-medium">{row.itemLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.verdictHint}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      With · {row.withCount} trades
                    </p>
                    <p className="font-mono text-sm">
                      {row.withWinRate}% WR · {formatR(row.withExpectancy)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Without · {row.withoutCount} trades
                    </p>
                    <p className="font-mono text-sm">
                      {row.withoutWinRate}% WR · {formatR(row.withoutExpectancy)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Δ expectancy</p>
                    <p
                      className={cn(
                        'font-mono text-sm',
                        row.sampleReady
                          ? row.deltaExpectancy >= 0
                            ? 'text-profit'
                            : 'text-loss'
                          : 'text-muted-foreground'
                      )}
                    >
                      {row.sampleReady
                        ? `${row.deltaExpectancy >= 0 ? '+' : ''}${row.deltaExpectancy}R`
                        : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function VerdictBadge({
  verdict,
}: {
  verdict: 'keep' | 'review' | 'cut' | 'needs_data'
}) {
  const label =
    verdict === 'keep'
      ? 'Keep'
      : verdict === 'cut'
        ? 'Cut'
        : verdict === 'review'
          ? 'Review'
          : 'Need data'
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        verdict === 'keep' && 'bg-profit/15 text-profit',
        verdict === 'cut' && 'bg-loss/15 text-loss',
        verdict === 'review' && 'bg-muted text-muted-foreground',
        verdict === 'needs_data' && 'border border-border/70 text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

function SequenceCard({
  title,
  count,
  winRate,
}: {
  title: string
  count: number
  winRate: number | null
}) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 font-mono text-3xl">{fmt(winRate, '%', 0)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        2nd setup win rate · {count} day{count === 1 ? '' : 's'} with ≥2 setups
      </p>
    </div>
  )
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
      {hint}
    </div>
  )
}
