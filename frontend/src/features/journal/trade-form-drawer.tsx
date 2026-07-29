import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ImagePlus, Loader2, X } from 'lucide-react'
import {
  useCreateJournalEntry,
  useStrategies,
  useUpdateJournalEntry,
} from '@/lib/hooks'
import type {
  ChecklistResponse,
  JournalEntry,
  JournalSource,
  PsychologyTag,
  Strategy,
  Trade,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError, uploadScreenshot } from '@/lib/api'
import { Separator } from '@/components/ui/separator'

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function parseRequiredNumber(value: string, label: string): number {
  const n = Number(value)
  if (value.trim() === '' || !Number.isFinite(n)) {
    throw new Error(`${label} is required`)
  }
  return n
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function numOrEmpty(n: number | undefined | null) {
  return n === undefined || n === null ? '' : String(n)
}

function buildTradeFormSchema(_source: JournalSource) {
  return z.object({
    date: z.string().min(1),
    symbol: z.string().min(1, 'Symbol is required'),
    direction: z.enum(['long', 'short']),
    entry: z.string().optional(),
    exit: z.string().optional(),
    stopLoss: z.string().optional(),
    takeProfit: z.string().optional(),
    risk: z.string().optional(),
    contracts: z.string().optional(),
    resultUsd: z.string().optional(),
    resultR: z.string().min(1, 'Result (R) is required — use 0 for BE'),
    maximumRr: z.string().optional(),
    commission: z.string().optional(),
    session: z.enum(['asia', 'london', 'newyork', 'overlap', 'other']),
    notes: z.string().optional(),
  })
}

type TradeFormValues = z.infer<ReturnType<typeof buildTradeFormSchema>>

const emptyDefaults: TradeFormValues = {
  date: new Date().toISOString().slice(0, 16),
  direction: 'long',
  session: 'london',
  contracts: '',
  commission: '',
  risk: '',
  entry: '',
  exit: '',
  stopLoss: '',
  takeProfit: '',
  resultUsd: '',
  resultR: '',
  maximumRr: '',
  symbol: '',
  notes: '',
}

const psychologyOptions: { value: PsychologyTag; label: string }[] = [
  { value: 'fomo', label: 'FOMO' },
  { value: 'revenge', label: 'Revenge' },
  { value: 'early_exit', label: 'Early exit' },
  { value: 'late_entry', label: 'Late entry' },
  { value: 'oversized_risk', label: 'Oversized risk' },
  { value: 'rule_violation', label: 'Rule violation' },
  { value: 'moving_stop', label: 'Moving stop' },
]

function buildChecklist(strategy?: Strategy): ChecklistResponse[] {
  if (!strategy) return []
  return [...strategy.categories]
    .sort((a, b) => a.order - b.order)
    .flatMap((cat) =>
      [...cat.items]
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          categoryId: cat._id,
          categoryName: cat.name,
          itemId: item._id,
          itemLabel: item.label,
          checked: false,
        }))
    )
}

function valuesFromTrade(trade: Trade | JournalEntry): TradeFormValues {
  return {
    date: toLocalInput(trade.date),
    symbol: trade.symbol || '',
    direction: trade.direction || 'long',
    entry: numOrEmpty(trade.entry),
    exit: numOrEmpty(trade.exit),
    stopLoss: numOrEmpty(trade.stopLoss),
    takeProfit: numOrEmpty(trade.takeProfit),
    risk: String(trade.risk ?? ''),
    contracts: String(trade.contracts ?? ''),
    resultUsd: String(trade.resultUsd ?? ''),
    resultR: String(trade.resultR ?? ''),
    maximumRr: numOrEmpty(trade.maximumRr),
    commission: trade.commission ? String(trade.commission) : '',
    session: trade.session || 'london',
    notes: trade.notes ?? '',
  }
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function TradeFormDrawer({
  open,
  onOpenChange,
  trade = null,
  source: sourceProp = 'taken',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trade?: Trade | JournalEntry | null
  source?: JournalSource
}) {
  const { data: strategies } = useStrategies()
  const createTrade = useCreateJournalEntry()
  const updateTrade = useUpdateJournalEntry()
  const isEdit = Boolean(trade)
  const source: JournalSource =
    trade && 'source' in trade && trade.source
      ? trade.source
      : sourceProp

  const [checklist, setChecklist] = useState<ChecklistResponse[]>([])
  const [tags, setTags] = useState<PsychologyTag[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState('')
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [uploadingShot, setUploadingShot] = useState(false)

  const schema = useMemo(() => buildTradeFormSchema(source), [source])

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults,
  })

  useEffect(() => {
    form.clearErrors()
  }, [schema, form])

  const selectedStrategy = useMemo(
    () => strategies?.find((s) => s._id === selectedStrategyId),
    [strategies, selectedStrategyId]
  )

  useEffect(() => {
    if (!open) return
    if (trade) {
      form.reset(valuesFromTrade(trade))
      setSelectedStrategyId(trade.strategyId || '')
      setTags(trade.psychologyTags ?? [])
      setScreenshots(trade.screenshots ?? [])
      if (trade.checklist?.length) {
        setChecklist(trade.checklist)
      } else {
        const strategy = strategies?.find((s) => s._id === trade.strategyId)
        setChecklist(buildChecklist(strategy))
      }
    } else {
      form.reset({
        ...emptyDefaults,
        date: toLocalInput(new Date().toISOString()),
      })
      setSelectedStrategyId('')
      setTags([])
      setScreenshots([])
      setChecklist([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trade?._id, source])

  function onStrategyChange(value: string) {
    const nextId = value === 'none' ? '' : value
    setSelectedStrategyId(nextId)
    const strategy = strategies?.find((s) => s._id === nextId)
    setChecklist(buildChecklist(strategy))
  }

  const groupedChecklist = useMemo(() => {
    const map = new Map<string, ChecklistResponse[]>()
    for (const item of checklist) {
      if (!map.has(item.categoryName)) map.set(item.categoryName, [])
      map.get(item.categoryName)!.push(item)
    }
    return [...map.entries()]
  }, [checklist])

  async function onScreenshotChange(files: FileList | null) {
    if (!files?.length) return
    const remaining = Math.max(0, 4 - screenshots.length)
    const batch = [...files].slice(0, remaining)
    if (!batch.length) {
      toast.error('You can attach up to 4 screenshots')
      return
    }

    setUploadingShot(true)
    try {
      const uploaded: string[] = []
      for (const file of batch) {
        const result = await uploadScreenshot(file)
        uploaded.push(result.url)
      }
      setScreenshots((prev) => [...prev, ...uploaded])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploadingShot(false)
    }
  }

  async function onSubmit(values: TradeFormValues) {
    try {
      const resultR = parseRequiredNumber(values.resultR, 'Result (R)')
      const maximumRr = parseOptionalNumber(values.maximumRr)

      const body: Record<string, unknown> = {
        source,
        symbol: values.symbol,
        direction: values.direction,
        session: values.session,
        notes: values.notes,
        entry: parseOptionalNumber(values.entry),
        exit: parseOptionalNumber(values.exit),
        stopLoss: parseOptionalNumber(values.stopLoss),
        takeProfit: parseOptionalNumber(values.takeProfit),
        resultR,
        maximumRr: maximumRr ?? undefined,
        date: new Date(values.date).toISOString(),
        strategyId: selectedStrategyId || undefined,
        checklist,
        psychologyTags: tags,
        screenshots,
      }

      if (trade) {
        await updateTrade.mutateAsync({ id: trade._id, body })
        toast.success(source === 'taken' ? 'Taken trade updated' : 'Not-taken trade updated')
      } else {
        await createTrade.mutateAsync(body)
        toast.success(source === 'taken' ? 'Taken trade logged' : 'Not-taken trade logged')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save'
      )
    }
  }

  const direction = form.watch('direction')
  const saving = createTrade.isPending || updateTrade.isPending
  const title = isEdit
    ? source === 'taken'
      ? 'Edit taken trade'
      : 'Edit not-taken trade'
    : source === 'taken'
      ? 'Log taken trade'
      : 'Log not-taken trade'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="mt-1">
              {source === 'taken' ? 'Taken' : 'Not-taken'} journal entry — Result (R) of 0 =
              breakeven. No $, risk, contracts, or commission.
            </SheetDescription>
          </div>
          <SheetCloseButton />
        </SheetHeader>

        <form
          id="trade-form"
          className="flex-1 overflow-y-auto px-5 py-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-5">
            <Row>
              <Field label="Symbol">
                <Input
                  placeholder="ES"
                  autoFocus={!isEdit}
                  {...form.register('symbol')}
                />
              </Field>
              <Field label="Direction">
                <div className="grid grid-cols-2 gap-1.5">
                  {(['long', 'short'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => form.setValue('direction', dir)}
                      className={`h-9 rounded-md border text-sm capitalize transition-colors ${
                        direction === dir
                          ? dir === 'long'
                            ? 'border-profit/40 bg-profit/15 text-profit'
                            : 'border-loss/40 bg-loss/15 text-loss'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </Field>
            </Row>

            <Row>
              <Field label="Date">
                <Input type="datetime-local" {...form.register('date')} />
              </Field>
              <Field label="Session">
                <Select
                  value={form.watch('session')}
                  onValueChange={(v) =>
                    form.setValue('session', v as TradeFormValues['session'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asia">Asia</SelectItem>
                    <SelectItem value="london">London</SelectItem>
                    <SelectItem value="newyork">New York</SelectItem>
                    <SelectItem value="overlap">Overlap</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Row>

            <Field label="Strategy">
              <Select
                value={selectedStrategyId || 'none'}
                onValueChange={onStrategyChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No strategy</SelectItem>
                  {(strategies ?? []).map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} · v{s.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Separator />

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Result
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Result (R)">
                  <Input
                    type="number"
                    step="any"
                    placeholder="1.5 · 0 = BE"
                    {...form.register('resultR')}
                  />
                </Field>
                <Field label="Max RR">
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 2.5"
                    {...form.register('maximumRr')}
                  />
                </Field>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Levels <span className="normal-case tracking-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Entry">
                  <Input type="number" step="any" placeholder="—" {...form.register('entry')} />
                </Field>
                <Field label="Exit">
                  <Input type="number" step="any" placeholder="—" {...form.register('exit')} />
                </Field>
                <Field label="Stop">
                  <Input type="number" step="any" placeholder="—" {...form.register('stopLoss')} />
                </Field>
                <Field label="TP">
                  <Input type="number" step="any" placeholder="—" {...form.register('takeProfit')} />
                </Field>
              </div>
            </div>

            <Separator />

            <Field label="Notes">
              <Textarea
                className="min-h-[84px]"
                placeholder="What was the thesis?"
                {...form.register('notes')}
              />
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-normal text-muted-foreground">
                  Screenshots
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={uploadingShot || screenshots.length >= 4}
                  onClick={() => document.getElementById('drawer-screenshots')?.click()}
                >
                  {uploadingShot ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Add
                </Button>
                <input
                  id="drawer-screenshots"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onScreenshotChange(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
              {screenshots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {screenshots.map((url) => (
                    <div
                      key={url}
                      className="group relative overflow-hidden rounded-md border border-border"
                    >
                      <img src={url} alt="" className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-background/90 p-0.5 opacity-0 group-hover:opacity-100"
                        onClick={() =>
                          setScreenshots((prev) => prev.filter((u) => u !== url))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-normal text-muted-foreground">
                Psychology
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {psychologyOptions.map((opt) => {
                  const active = tags.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setTags((prev) =>
                          active
                            ? prev.filter((t) => t !== opt.value)
                            : [...prev, opt.value]
                        )
                      }
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        active
                          ? 'border-zinc-500 bg-zinc-800 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {groupedChecklist.length > 0 ? (
              <div className="space-y-3 rounded-md border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium">Checklist</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedStrategy?.name} · v{selectedStrategy?.version}
                  </p>
                </div>
                {groupedChecklist.map(([category, items]) => (
                  <div key={category} className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {category}
                    </p>
                    {items.map((item) => (
                      <label
                        key={item.itemId}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/40"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={item.checked}
                          onCheckedChange={(checked) =>
                            setChecklist((prev) =>
                              prev.map((row) =>
                                row.itemId === item.itemId
                                  ? { ...row, checked: Boolean(checked) }
                                  : row
                              )
                            )
                          }
                        />
                        <span className="text-sm leading-snug">{item.itemLabel}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </form>

        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="trade-form"
            disabled={saving || uploadingShot}
          >
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
