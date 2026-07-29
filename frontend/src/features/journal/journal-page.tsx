import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LayoutGrid,
  LayoutList,
  Images,
  Trash2,
  X,
} from 'lucide-react'
import {
  useDeleteJournalEntry,
  useJournalEntries,
} from '@/lib/hooks'
import type { InsightsSource, JournalEntry, JournalSource } from '@/types'
import { cn, formatR, pnlClass } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { TradeFormDrawer } from './trade-form-drawer'

const FILTERS: { id: InsightsSource; label: string }[] = [
  { id: 'combined', label: 'Combined' },
  { id: 'taken', label: 'Taken' },
  { id: 'not_taken', label: 'Not taken' },
]

type ViewMode = 'table' | 'cards' | 'gallery'

function toDateInput(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function fromDateInputStart(value: string) {
  return startOfDay(new Date(`${value}T12:00:00`)).toISOString()
}

function fromDateInputEnd(value: string) {
  return endOfDay(new Date(`${value}T12:00:00`)).toISOString()
}

function computeStats(items: JournalEntry[]) {
  const withR = items.filter((e) => typeof e.resultR === 'number')
  const count = items.length
  const avgR =
    withR.length === 0
      ? null
      : withR.reduce((s, e) => s + (e.resultR as number), 0) / withR.length

  const scored = withR.filter((e) => (e.resultR as number) !== 0)
  const wins = scored.filter((e) => (e.resultR as number) > 0).length
  const winRate = scored.length === 0 ? null : (wins / scored.length) * 100

  // Expectancy = average R across all entries with R (includes BE as 0)
  const expectancy = avgR

  return {
    count,
    winRate,
    avgR,
    expectancy,
    scoredSample: scored.length,
  }
}

export function JournalPage() {
  const [params, setParams] = useSearchParams()
  const showNewTaken = params.get('new') === '1'
  const showNewNotTaken = params.get('new') === 'not-taken'
  const [filter, setFilter] = useState<InsightsSource>('combined')
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [createSource, setCreateSource] = useState<JournalSource>('taken')
  const [view, setView] = useState<ViewMode>('table')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [carousel, setCarousel] = useState<{
    slides: Array<{ url: string; entry: JournalEntry; index: number }>
    index: number
  } | null>(null)

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | undefined> = {
      source: filter,
      limit: 500,
    }
    if (fromDate) q.from = fromDateInputStart(fromDate)
    if (toDate) q.to = fromDateInputEnd(toDate)
    return q
  }, [filter, fromDate, toDate])

  const { data, isLoading } = useJournalEntries(queryParams)
  const deleteEntry = useDeleteJournalEntry()

  const drawerOpen = showNewTaken || showNewNotTaken || Boolean(editing)

  const drawerSource: JournalSource = editing?.source
    ? editing.source
    : showNewNotTaken || createSource === 'not_taken'
      ? 'not_taken'
      : 'taken'

  const items = data?.items ?? []
  const stats = useMemo(() => computeStats(items), [items])

  const gallerySlides = useMemo(() => {
    const slides: Array<{ url: string; entry: JournalEntry; index: number }> = []
    let i = 0
    for (const entry of items) {
      for (const url of entry.screenshots ?? []) {
        slides.push({ url, entry, index: i++ })
      }
    }
    return slides
  }, [items])

  function closeDrawer() {
    setEditing(null)
    setCreateSource('taken')
    if (params.get('new')) {
      params.delete('new')
      setParams(params)
    }
  }

  function openNew(source: JournalSource) {
    setEditing(null)
    setCreateSource(source)
    setParams({ new: source === 'taken' ? '1' : 'not-taken' })
  }

  function openEdit(entry: JournalEntry) {
    params.delete('new')
    setParams(params)
    setEditing(entry)
  }

  async function onDelete(id: string) {
    try {
      await deleteEntry.mutateAsync(id)
      toast.success('Deleted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed')
    }
  }

  function setToday() {
    const today = toDateInput(new Date())
    setFromDate(today)
    setToDate(today)
  }

  function setThisWeek() {
    const now = new Date()
    setFromDate(toDateInput(startOfWeek(now, { weekStartsOn: 1 })))
    setToDate(toDateInput(endOfWeek(now, { weekStartsOn: 1 })))
  }

  function clearDates() {
    setFromDate('')
    setToDate('')
  }

  function openCarouselAt(entry: JournalEntry, shotUrl?: string) {
    if (!gallerySlides.length) return
    const idx = shotUrl
      ? gallerySlides.findIndex((s) => s.url === shotUrl && s.entry._id === entry._id)
      : gallerySlides.findIndex((s) => s.entry._id === entry._id)
    setCarousel({
      slides: gallerySlides,
      index: idx >= 0 ? idx : 0,
    })
  }

  useEffect(() => {
    if (!carousel) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCarousel(null)
      if (e.key === 'ArrowLeft') {
        setCarousel((c) =>
          c
            ? {
                ...c,
                index: (c.index - 1 + c.slides.length) % c.slides.length,
              }
            : c
        )
      }
      if (e.key === 'ArrowRight') {
        setCarousel((c) =>
          c ? { ...c, index: (c.index + 1) % c.slides.length } : c
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [carousel])

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Journal
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Filter by source and date. Switch views · Result (R) of 0 = breakeven.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openNew('not_taken')}>
            Log not-taken
          </Button>
          <Button type="button" size="sm" onClick={() => openNew('taken')}>
            Log taken
          </Button>
        </div>
      </motion.div>

      <TradeFormDrawer
        key={`${drawerSource}-${editing?._id ?? 'new'}`}
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
        source={drawerSource}
        trade={editing}
      />

      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-border/70 bg-card/40 p-2">
        <div className="flex shrink-0 gap-1 rounded-lg border border-border/70 p-1">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={filter === f.id ? 'default' : 'ghost'}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="flex shrink-0 gap-1 rounded-lg border border-border/70 p-1">
          {(
            [
              ['table', LayoutList, 'Table'],
              ['cards', LayoutGrid, 'Cards'],
              ['gallery', Images, 'Gallery'],
            ] as const
          ).map(([id, Icon, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={view === id ? 'default' : 'ghost'}
              onClick={() => setView(id)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-border lg:block" />

        <Input
          type="date"
          aria-label="From date"
          className="h-8 w-[9.5rem] shrink-0"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <span className="shrink-0 text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          aria-label="To date"
          className="h-8 w-[9.5rem] shrink-0"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={setToday}>
          Today
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={setThisWeek}
        >
          This week
        </Button>
        <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={clearDates}>
          Clear
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Count" value={String(stats.count)} hint="Filtered entries" />
        <StatCard
          label="Win rate"
          value={stats.winRate == null ? '—' : `${stats.winRate.toFixed(0)}%`}
          hint={
            stats.scoredSample
              ? `${stats.scoredSample} win/loss (excludes BE)`
              : 'Needs non-zero R'
          }
        />
        <StatCard
          label="Avg R"
          value={stats.avgR == null ? '—' : formatR(stats.avgR)}
          hint="Mean Result (R)"
        />
        <StatCard
          label="Expectancy"
          value={stats.expectancy == null ? '—' : formatR(stats.expectancy)}
          hint="Avg R on filtered set"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            {items.length} shown
            {fromDate || toDate
              ? ` · ${fromDate || '…'} → ${toDate || '…'}`
              : ' · all dates'}
            {view === 'gallery' ? ` · ${gallerySlides.length} images` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
              <p className="text-sm text-muted-foreground">
                No entries for this filter. Adjust dates or log a trade.
              </p>
            </div>
          ) : view === 'table' ? (
            <TableView
              items={items}
              onEdit={openEdit}
              onDelete={(id) => void onDelete(id)}
            />
          ) : view === 'cards' ? (
            <CardsView
              items={items}
              onEdit={openEdit}
              onDelete={(id) => void onDelete(id)}
              onOpenShot={openCarouselAt}
            />
          ) : (
            <GalleryView
              slides={gallerySlides}
              onOpen={(index) =>
                setCarousel({ slides: gallerySlides, index })
              }
              onEditEntry={openEdit}
            />
          )}
        </CardContent>
      </Card>

      {carousel ? (
        <CarouselModal
          slides={carousel.slides}
          index={carousel.index}
          onClose={() => setCarousel(null)}
          onIndex={(index) => setCarousel((c) => (c ? { ...c, index } : c))}
          onEditEntry={(entry) => {
            setCarousel(null)
            openEdit(entry)
          }}
        />
      ) : null}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  )
}

function TableView({
  items,
  onEdit,
  onDelete,
}: {
  items: JournalEntry[]
  onEdit: (e: JournalEntry) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-3 font-medium">When</th>
            <th className="px-2 py-3 font-medium">Source</th>
            <th className="px-2 py-3 font-medium">Symbol</th>
            <th className="px-2 py-3 font-medium">Strategy</th>
            <th className="px-2 py-3 font-medium">R</th>
            <th className="px-2 py-3 font-medium">Max RR</th>
            <th className="px-2 py-3 font-medium">Shot</th>
            <th className="px-2 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {items.map((entry) => (
            <tr
              key={entry._id}
              className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/30"
              onClick={() => onEdit(entry)}
            >
              <td className="px-2 py-3 text-muted-foreground">
                {format(new Date(entry.date), 'MMM d, HH:mm')}
              </td>
              <td className="px-2 py-3">
                <Badge variant={entry.source === 'taken' ? 'default' : 'outline'}>
                  {entry.source === 'taken' ? 'Taken' : 'Not taken'}
                </Badge>
              </td>
              <td className="px-2 py-3 font-medium">
                {entry.symbol || '—'}{' '}
                {entry.direction ? (
                  <span
                    className={cn(
                      'text-xs capitalize',
                      entry.direction === 'long' ? 'text-profit' : 'text-loss'
                    )}
                  >
                    {entry.direction}
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-3 text-muted-foreground">
                {entry.strategyName || '—'}
              </td>
              <td className={`px-2 py-3 font-mono ${pnlClass(entry.resultR)}`}>
                {entry.resultR == null ? '—' : formatR(entry.resultR)}
              </td>
              <td className="px-2 py-3 font-mono text-muted-foreground">
                {entry.maximumRr != null ? `${entry.maximumRr}R` : '—'}
              </td>
              <td className="px-2 py-3 text-muted-foreground">
                {entry.screenshots?.length ? (
                  <a
                    href={entry.screenshots[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    {entry.screenshots.length}
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-2 py-3 text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(entry._id)
                  }}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardsView({
  items,
  onEdit,
  onDelete,
  onOpenShot,
}: {
  items: JournalEntry[]
  onEdit: (e: JournalEntry) => void
  onDelete: (id: string) => void
  onOpenShot: (entry: JournalEntry, url?: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((entry) => (
        <div
          key={entry._id}
          className="group cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-card transition-colors hover:border-zinc-600"
          onClick={() => onEdit(entry)}
        >
          {entry.screenshots?.[0] ? (
            <button
              type="button"
              className="relative block h-36 w-full overflow-hidden bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onOpenShot(entry, entry.screenshots[0])
              }}
            >
              <img
                src={entry.screenshots[0]}
                alt=""
                className="h-full w-full object-cover"
              />
              {entry.screenshots.length > 1 ? (
                <span className="absolute bottom-2 right-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-mono">
                  +{entry.screenshots.length - 1}
                </span>
              ) : null}
            </button>
          ) : (
            <div className="flex h-20 items-center justify-center border-b border-border/50 text-xs text-muted-foreground">
              No screenshot
            </div>
          )}
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {entry.symbol || '—'}{' '}
                  {entry.direction ? (
                    <span
                      className={cn(
                        'text-xs capitalize',
                        entry.direction === 'long' ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {entry.direction}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(entry.date), 'MMM d, HH:mm')}
                </p>
              </div>
              <Badge variant={entry.source === 'taken' ? 'default' : 'outline'}>
                {entry.source === 'taken' ? 'Taken' : 'Not taken'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={`font-mono ${pnlClass(entry.resultR)}`}>
                {entry.resultR == null ? '—' : formatR(entry.resultR)}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Max {entry.maximumRr != null ? `${entry.maximumRr}R` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="truncate text-xs text-muted-foreground">
                {entry.strategyName || 'No strategy'}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(entry._id)
                }}
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function GalleryView({
  slides,
  onOpen,
  onEditEntry,
}: {
  slides: Array<{ url: string; entry: JournalEntry; index: number }>
  onOpen: (index: number) => void
  onEditEntry: (entry: JournalEntry) => void
}) {
  if (!slides.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 p-10 text-center text-sm text-muted-foreground">
        No screenshots in this filter. Attach charts when logging trades.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {slides.map((slide) => (
        <button
          key={`${slide.entry._id}-${slide.index}`}
          type="button"
          className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border/70"
          onClick={() => onOpen(slide.index)}
          onDoubleClick={() => onEditEntry(slide.entry)}
        >
          <img
            src={slide.url}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left">
            <p className="truncate text-xs font-medium text-white">
              {slide.entry.symbol || 'Trade'} ·{' '}
              {slide.entry.resultR == null ? '—' : formatR(slide.entry.resultR)}
            </p>
            <p className="text-[10px] text-white/70">
              {format(new Date(slide.entry.date), 'MMM d')} ·{' '}
              {slide.entry.source === 'taken' ? 'Taken' : 'Not taken'}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

function CarouselModal({
  slides,
  index,
  onClose,
  onIndex,
  onEditEntry,
}: {
  slides: Array<{ url: string; entry: JournalEntry; index: number }>
  index: number
  onClose: () => void
  onIndex: (index: number) => void
  onEditEntry: (entry: JournalEntry) => void
}) {
  const slide = slides[index]
  if (!slide) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground sm:left-6"
        onClick={(e) => {
          e.stopPropagation()
          onIndex((index - 1 + slides.length) % slides.length)
        }}
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground sm:right-6"
        onClick={(e) => {
          e.stopPropagation()
          onIndex((index + 1) % slides.length)
        }}
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 text-sm text-white/90">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {slide.entry.symbol || 'Trade'} ·{' '}
              {slide.entry.resultR == null ? '—' : formatR(slide.entry.resultR)}
            </p>
            <p className="text-xs text-white/60">
              {format(new Date(slide.entry.date), 'MMM d, HH:mm')} ·{' '}
              {index + 1}/{slides.length}
              {slide.entry.strategyName ? ` · ${slide.entry.strategyName}` : ''}
            </p>
            {slide.entry.notes ? (
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/75">
                {slide.entry.notes}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEditEntry(slide.entry)}
            >
              Edit entry
            </Button>
            <a
              href={slide.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-md border border-border bg-secondary px-3 text-xs text-secondary-foreground hover:bg-accent"
            >
              Open
            </a>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <img
            src={slide.url}
            alt=""
            className="max-h-[min(80vh,780px)] w-auto max-w-full rounded-lg object-contain"
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
