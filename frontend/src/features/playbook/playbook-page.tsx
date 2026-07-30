import { useState } from 'react'
import { usePlaybook } from '@/lib/hooks'
import type { InsightsSource } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

export function PlaybookPage() {
  const [source, setSource] = useState<InsightsSource>('taken')
  const [slotSize, setSlotSize] = useState<SlotSize>(30)
  const [playbookTime, setPlaybookTime] = useState<number | null>(null)
  const [playbookSetup, setPlaybookSetup] = useState<number | null>(null)

  const { data: playbook, isLoading } = usePlaybook({
    source,
    slotMinutes: slotSize,
    startMin: playbookTime,
    setupIndex: playbookSetup,
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Playbook</h1>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Combine time + setup # — TP/BE, expectancy, and rule audit for one filtered slice
            (IST).
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 p-1">
          {SOURCES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={source === s.id ? 'default' : 'ghost'}
              onClick={() => {
                setSource(s.id)
                setPlaybookTime(null)
                setPlaybookSetup(null)
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Slice</CardTitle>
          <CardDescription>
            Pick a clock time and/or setup # of day. Everything below uses the same trades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Slot size</p>
              <div className="flex gap-1 rounded-lg border border-border/70 p-1">
                {SLOT_OPTIONS.map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    size="sm"
                    variant={slotSize === o.id ? 'default' : 'ghost'}
                    onClick={() => {
                      setSlotSize(o.id)
                      setPlaybookTime(null)
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="min-w-[140px] space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Time</p>
              <Select
                value={playbookTime == null ? 'all' : String(playbookTime)}
                onValueChange={(v) => setPlaybookTime(v === 'all' ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All times" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All times</SelectItem>
                  {(playbook?.options.times ?? []).map((t) => (
                    <SelectItem key={t.startMin} value={String(t.startMin)}>
                      {t.label} · {t.count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px] space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Setup # of day
              </p>
              <Select
                value={playbookSetup == null ? 'all' : String(playbookSetup)}
                onValueChange={(v) => setPlaybookSetup(v === 'all' ? null : Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All setups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All setups</SelectItem>
                  {(playbook?.options.setupIndexes ?? []).map((s) => (
                    <SelectItem key={s.setupIndex} value={String(s.setupIndex)}>
                      #{s.setupIndex} · {s.count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading || !playbook ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {playbook.filters.timeLabel}
                  </span>
                  {' · '}
                  <span className="font-medium text-foreground">
                    {playbook.filters.setupLabel}
                  </span>
                  {' · '}
                  {playbook.slice.count} trade{playbook.slice.count === 1 ? '' : 's'}
                </p>
                {playbook.slice.note ? (
                  <p className="text-xs text-muted-foreground">{playbook.slice.note}</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PlaybookStat label="Win rate" value={fmt(playbook.slice.winRate, '%', 0)} />
                <PlaybookStat
                  label="Avg R"
                  value={fmt(playbook.slice.expectancy, 'R', 2)}
                  tone={
                    (playbook.slice.expectancy ?? 0) > 0
                      ? 'profit'
                      : (playbook.slice.expectancy ?? 0) < 0
                        ? 'loss'
                        : undefined
                  }
                />
                <PlaybookStat
                  label="Suggested TP"
                  value={
                    playbook.slice.suggestedTpR != null
                      ? `${playbook.slice.suggestedTpR}R`
                      : '—'
                  }
                  hint="≥60% Max hit"
                />
                <PlaybookStat
                  label="BE after"
                  value={
                    playbook.slice.suggestedBeR != null
                      ? `${playbook.slice.suggestedBeR}R`
                      : '—'
                  }
                  hint={
                    playbook.slice.beSource === 'retest'
                      ? `Retest peak · n=${playbook.slice.withRetestSample}`
                      : playbook.slice.beSource === 'max_rr_fallback'
                        ? 'Max RR fallback'
                        : 'Log max before retest'
                  }
                />
              </div>

              {playbook.slice.withRetestSample > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Median max-before-retest (≥0.5R):{' '}
                  <span className="font-mono text-foreground">
                    {playbook.slice.medianMaxBeforeRetest != null
                      ? `${playbook.slice.medianMaxBeforeRetest}R`
                      : '—'}
                  </span>{' '}
                  · sample {playbook.slice.withRetestSample}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No max-before-retest logged yet — BE falls back to Max RR hit rates. Log the peak
                  before first return to entry (skip noise under 0.5R).
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Max RR hit rate in this slice
                </p>
                <div className="flex flex-wrap gap-3 font-mono text-sm">
                  {playbook.slice.hitRates.map((h) => (
                    <span
                      key={h.thresholdR}
                      className="rounded-md border border-border/60 px-2 py-1"
                    >
                      {h.label} {fmt(h.pct, '%', 0)}
                    </span>
                  ))}
                </div>
              </div>

              {playbook.setupBreakdown.length > 1 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Setup # inside this time filter
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {playbook.setupBreakdown.map((b) => (
                      <button
                        key={b.setupIndex}
                        type="button"
                        onClick={() => setPlaybookSetup(b.setupIndex)}
                        className="rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/20"
                      >
                        <p className="text-xs text-muted-foreground">#{b.setupIndex}</p>
                        <p className="font-mono text-lg">{b.count}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          WR {fmt(b.winRate, '%', 0)} · R {fmt(b.expectancy, 'R', 2)} · TP{' '}
                          {b.suggestedTpR != null ? `${b.suggestedTpR}R` : '—'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rule audit in this slice
                </p>
                {playbook.slice.checklistImpact.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No checklist data in this filter — log strategy checklists on taken trades.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {playbook.slice.checklistImpact.map((row) => (
                      <div
                        key={`${row.categoryName}-${row.itemLabel}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <VerdictBadge verdict={row.verdict} />
                            <span className="font-medium">{row.itemLabel}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{row.verdictHint}</p>
                        </div>
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
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PlaybookStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'profit' | 'loss'
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-mono text-xl font-semibold',
          tone === 'profit' && 'text-profit',
          tone === 'loss' && 'text-loss'
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
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
