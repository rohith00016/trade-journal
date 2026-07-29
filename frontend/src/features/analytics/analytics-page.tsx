import { useState } from 'react'
import { useInsights } from '@/lib/hooks'
import type { InsightsSource } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatR, cn } from '@/lib/utils'

const SOURCES: { id: InsightsSource; label: string }[] = [
  { id: 'combined', label: 'Combined' },
  { id: 'taken', label: 'Taken' },
  { id: 'not_taken', label: 'Not taken' },
]

function fmt(n: number | null | undefined, suffix = '', digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Number(n).toFixed(digits)}${suffix}`
}

export function AnalyticsPage() {
  const [source, setSource] = useState<InsightsSource>('combined')
  const { data, isLoading } = useInsights(source)

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
            Taken trades, not-taken setups, or both — find R capture gaps, sequence rules, and
            better hours.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 p-1">
          {SOURCES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={source === s.id ? 'default' : 'ghost'}
              onClick={() => setSource(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {data.counts.filtered} event
        {data.counts.filtered === 1 ? '' : 's'} · {data.counts.taken} taken ·{' '}
        {data.counts.notTaken} not taken
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          title="Win rate"
          value={fmt(data.summary.winRate, '%', 1)}
          hint={
            data.summary.scoredSample
              ? `${data.summary.scoredSample} scored`
              : 'Needs win/loss outcomes'
          }
        />
        <Stat title="Avg Max RR" value={fmt(data.summary.avgMaxRr, 'R', 2)} />
        <Stat title="Avg realized R" value={fmt(data.summary.avgResultR, 'R', 2)} />
        <Stat
          title="Capture"
          value={fmt(data.summary.avgCapturePct, '%', 0)}
          hint={
            data.summary.takenWithMaxRr
              ? `${data.summary.takenWithMaxRr} trades with Max RR`
              : 'Add Max RR on trades'
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Max RR vs realized R</CardTitle>
          <CardDescription>{data.rrGap.note}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Avg Max RR" value={fmt(data.rrGap.avgMaxRr, 'R', 2)} />
            <Metric label="Avg realized" value={fmt(data.rrGap.avgRealizedR, 'R', 2)} />
            <Metric label="Avg capture" value={fmt(data.rrGap.avgCapturePct, '%', 0)} />
          </div>
          {data.rrGap.sample === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Log Max RR on journaled trades to measure how much R you keep vs leave.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sequence after first trade</CardTitle>
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
          <CardTitle>By hour (IST)</CardTitle>
          <CardDescription>
            When setups and trades cluster in Indian Standard Time — and how they perform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.hourBuckets.length === 0 ? (
            <Empty hint="No events yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Hour</th>
                    <th className="pb-2 pr-3 font-medium">Events</th>
                    <th className="pb-2 pr-3 font-medium">Taken / not</th>
                    <th className="pb-2 pr-3 font-medium">Win rate</th>
                    <th className="pb-2 pr-3 font-medium">Avg Max</th>
                    <th className="pb-2 font-medium">Avg R</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hourBuckets.map((b) => (
                    <tr key={b.hour} className="border-b border-border/40">
                      <td className="py-2.5 pr-3 font-mono text-xs">{b.label}</td>
                      <td className="py-2.5 pr-3 font-mono">{b.count}</td>
                      <td className="py-2.5 pr-3 font-mono text-muted-foreground">
                        {b.takenCount} / {b.notTakenCount}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{fmt(b.winRate, '%', 0)}</td>
                      <td className="py-2.5 pr-3 font-mono">{fmt(b.avgMaxRr, 'R', 2)}</td>
                      <td className="py-2.5 font-mono">{fmt(b.avgResultR, 'R', 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup # of day</CardTitle>
          <CardDescription>
            1st vs 2nd vs 3rd occurrence that day — are later setups worse?
          </CardDescription>
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

      {source !== 'not_taken' ? (
        <Card>
          <CardHeader>
            <CardTitle>Checklist impact</CardTitle>
            <CardDescription>
              Taken trades with a checklist item checked vs without — needs ≥3 each side.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.checklistImpact.length === 0 ? (
              <Empty hint="Log more trades with mixed checklist answers to unlock rule-impact analysis." />
            ) : (
              <div className="space-y-3">
                {data.checklistImpact.map((row) => (
                  <div
                    key={`${row.categoryName}-${row.itemLabel}`}
                    className="grid gap-3 rounded-xl border border-border/70 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {row.categoryName}
                      </p>
                      <p className="font-medium">{row.itemLabel}</p>
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
                          row.deltaExpectancy >= 0 ? 'text-profit' : 'text-loss'
                        )}
                      >
                        {row.deltaExpectancy >= 0 ? '+' : ''}
                        {row.deltaExpectancy}R
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Stat({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-mono text-2xl">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl">{value}</p>
    </div>
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
        2nd trade win rate · {count} day{count === 1 ? '' : 's'} with ≥2 trades
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
