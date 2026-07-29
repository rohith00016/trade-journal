import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Archive,
  Copy,
  GitBranch,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useArchiveStrategy,
  useCreateStrategy,
  useCreateStrategyVersion,
  useDuplicateStrategy,
  useStrategies,
  useUpdateStrategy,
} from '@/lib/hooks'
import type { ChecklistCategory, Strategy } from '@/types'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

function emptyCategory(name = 'Market Structure'): ChecklistCategory {
  return {
    _id: crypto.randomUUID(),
    name,
    order: 0,
    items: [
      {
        _id: crypto.randomUUID(),
        label: 'Higher timeframe bias aligned',
        order: 0,
        isRequired: true,
      },
    ],
  }
}

function defaultCategories(): ChecklistCategory[] {
  return [
    emptyCategory('Market Structure'),
    {
      ...emptyCategory('Entry'),
      order: 1,
      items: [
        {
          _id: crypto.randomUUID(),
          label: 'Liquidity sweep confirmed',
          order: 0,
          isRequired: true,
        },
      ],
    },
    {
      ...emptyCategory('Risk'),
      order: 2,
      items: [
        {
          _id: crypto.randomUUID(),
          label: 'Risk sized to plan',
          order: 0,
          isRequired: true,
        },
      ],
    },
  ]
}

type Draft = {
  name: string
  description: string
  markets: string
  timeframes: string
  riskRules: string
  tpRules: string
  breakEvenRules: string
  categories: ChecklistCategory[]
}

function toDraft(strategy?: Strategy): Draft {
  if (!strategy) {
    return {
      name: '',
      description: '',
      markets: 'ES, NQ',
      timeframes: '5m, 15m',
      riskRules: 'Max 1R\nStop beyond invalidation',
      tpRules: 'Partial at 2R\nRunner to structure',
      breakEvenRules: 'BE after 1R',
      categories: defaultCategories(),
    }
  }
  return {
    name: strategy.name,
    description: strategy.description || '',
    markets: strategy.markets.join(', '),
    timeframes: strategy.timeframes.join(', '),
    riskRules: strategy.rules.riskRules.join('\n'),
    tpRules: strategy.rules.tpRules.join('\n'),
    breakEvenRules: strategy.rules.breakEvenRules.join('\n'),
    categories: strategy.categories.map((c) => ({
      ...c,
      items: [...c.items],
    })),
  }
}

function toPayload(draft: Draft) {
  const lines = (s: string) =>
    s
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
  return {
    name: draft.name,
    description: draft.description || undefined,
    markets: draft.markets
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    timeframes: draft.timeframes
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    rules: {
      riskRules: lines(draft.riskRules),
      tpRules: lines(draft.tpRules),
      breakEvenRules: lines(draft.breakEvenRules),
    },
    categories: draft.categories.map((cat, catIndex) => ({
      name: cat.name,
      order: catIndex,
      items: cat.items.map((item, itemIndex) => ({
        label: item.label,
        description: item.description,
        order: itemIndex,
        isRequired: item.isRequired,
      })),
    })),
    isActive: true,
  }
}

export function StrategiesPage() {
  const [params, setParams] = useSearchParams()
  const editingNew = params.get('new') === '1'
  const { data: strategies, isLoading } = useStrategies()
  const createStrategy = useCreateStrategy()
  const updateStrategy = useUpdateStrategy()
  const archiveStrategy = useArchiveStrategy()
  const duplicateStrategy = useDuplicateStrategy()
  const createVersion = useCreateStrategyVersion()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(toDraft())
  const [isCreating, setIsCreating] = useState(false)

  const selected = useMemo(
    () => strategies?.find((s) => s._id === selectedId),
    [strategies, selectedId]
  )

  useEffect(() => {
    if (editingNew) {
      setIsCreating(true)
      setSelectedId(null)
      setDraft(toDraft())
    }
  }, [editingNew])

  useEffect(() => {
    if (!isCreating && selected) setDraft(toDraft(selected))
  }, [selected, isCreating])

  useEffect(() => {
    if (!selectedId && strategies?.[0] && !isCreating && !editingNew) {
      setSelectedId(strategies[0]._id)
    }
  }, [strategies, selectedId, isCreating, editingNew])

  function startCreate() {
    setIsCreating(true)
    setSelectedId(null)
    setDraft(toDraft())
    setParams({ new: '1' })
  }

  function selectStrategy(id: string) {
    setIsCreating(false)
    setSelectedId(id)
    params.delete('new')
    setParams(params)
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error('Strategy name is required')
      return
    }
    try {
      const body = toPayload(draft)
      if (isCreating) {
        const created = await createStrategy.mutateAsync(body)
        toast.success('Strategy created')
        setIsCreating(false)
        params.delete('new')
        setParams(params)
        setSelectedId(created._id)
      } else if (selectedId) {
        await updateStrategy.mutateAsync({ id: selectedId, body })
        toast.success('Strategy updated')
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    }
  }

  async function onDuplicate(id: string) {
    try {
      const copy = await duplicateStrategy.mutateAsync(id)
      toast.success('Strategy duplicated')
      setSelectedId(copy._id)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Duplicate failed')
    }
  }

  async function onArchive(id: string) {
    try {
      await archiveStrategy.mutateAsync(id)
      toast.success('Strategy archived')
      setSelectedId(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Archive failed')
    }
  }

  async function onVersion(id: string) {
    try {
      const version = await createVersion.mutateAsync({
        id,
        body: toPayload(draft),
      })
      toast.success(`Created v${version.version}`)
      setSelectedId(version._id)
      setIsCreating(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Version failed')
    }
  }

  function updateCategory(index: number, patch: Partial<ChecklistCategory>) {
    setDraft((d) => ({
      ...d,
      categories: d.categories.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }))
  }

  function addCategory() {
    setDraft((d) => ({
      ...d,
      categories: [
        ...d.categories,
        {
          _id: crypto.randomUUID(),
          name: 'New category',
          order: d.categories.length,
          items: [],
        },
      ],
    }))
  }

  function removeCategory(index: number) {
    setDraft((d) => ({
      ...d,
      categories: d.categories.filter((_, i) => i !== index),
    }))
  }

  function addItem(catIndex: number) {
    setDraft((d) => ({
      ...d,
      categories: d.categories.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              items: [
                ...c.items,
                {
                  _id: crypto.randomUUID(),
                  label: 'New checklist item',
                  order: c.items.length,
                  isRequired: false,
                },
              ],
            }
          : c
      ),
    }))
  }

  function updateItem(catIndex: number, itemIndex: number, label: string) {
    setDraft((d) => ({
      ...d,
      categories: d.categories.map((c, i) =>
        i === catIndex
          ? {
              ...c,
              items: c.items.map((item, j) =>
                j === itemIndex ? { ...item, label } : item
              ),
            }
          : c
      ),
    }))
  }

  function removeItem(catIndex: number, itemIndex: number) {
    setDraft((d) => ({
      ...d,
      categories: d.categories.map((c, i) =>
        i === catIndex
          ? { ...c, items: c.items.filter((_, j) => j !== itemIndex) }
          : c
      ),
    }))
  }

  function moveItem(catIndex: number, itemIndex: number, dir: -1 | 1) {
    setDraft((d) => {
      const categories = d.categories.map((c) => ({ ...c, items: [...c.items] }))
      const items = categories[catIndex].items
      const target = itemIndex + dir
      if (target < 0 || target >= items.length) return d
      ;[items[itemIndex], items[target]] = [items[target], items[itemIndex]]
      return { ...d, categories }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Strategies
          </h1>
          <p className="mt-1 text-muted-foreground">
            Design rules and dynamic checklists. Version them to measure real improvement.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          New strategy
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Library</CardTitle>
            <CardDescription>Active strategy versions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !strategies?.length && !isCreating ? (
              <div className="rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                Create your first strategy to power journal checklists.
              </div>
            ) : (
              <>
                {isCreating ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm">
                    New strategy draft
                  </div>
                ) : null}
                {strategies?.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => selectStrategy(s._id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selectedId === s._id && !isCreating
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-border/70 hover:bg-accent/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.categories.reduce((n, c) => n + c.items.length, 0)} checklist items
                      </p>
                    </div>
                    <Badge variant="secondary">v{s.version}</Badge>
                  </button>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{isCreating ? 'Create strategy' : draft.name || 'Strategy'}</CardTitle>
              <CardDescription>
                Categories and items are fully dynamic — nothing is hardcoded.
              </CardDescription>
            </div>
            {!isCreating && selectedId ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDuplicate(selectedId)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onVersion(selectedId)}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  New version
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onArchive(selectedId)}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {!isCreating && !selected && !strategies?.length ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Select or create a strategy to edit.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Name</Label>
                    <Input
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                      placeholder="IFVG Continuation"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={draft.description}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, description: e.target.value }))
                      }
                      placeholder="When and why you take this setup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Markets</Label>
                    <Input
                      value={draft.markets}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, markets: e.target.value }))
                      }
                      placeholder="ES, NQ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeframes</Label>
                    <Input
                      value={draft.timeframes}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, timeframes: e.target.value }))
                      }
                      placeholder="5m, 15m"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Risk rules</Label>
                    <Textarea
                      value={draft.riskRules}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, riskRules: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TP rules</Label>
                    <Textarea
                      value={draft.tpRules}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, tpRules: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Break-even rules</Label>
                    <Textarea
                      value={draft.breakEvenRules}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          breakEvenRules: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Dynamic checklist</p>
                      <p className="text-sm text-muted-foreground">
                        Categories load into the journal when this strategy is selected.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                      <Plus className="h-3.5 w-3.5" />
                      Category
                    </Button>
                  </div>

                  {draft.categories.map((cat, catIndex) => (
                    <div
                      key={cat._id}
                      className="space-y-3 rounded-xl border border-border/80 bg-muted/15 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={cat.name}
                          onChange={(e) =>
                            updateCategory(catIndex, { name: e.target.value })
                          }
                          className="font-medium"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeCategory(catIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {cat.items.map((item, itemIndex) => (
                          <div key={item._id} className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <Input
                              value={item.label}
                              onChange={(e) =>
                                updateItem(catIndex, itemIndex, e.target.value)
                              }
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => moveItem(catIndex, itemIndex, -1)}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => moveItem(catIndex, itemIndex, 1)}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeItem(catIndex, itemIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => addItem(catIndex)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add item
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button onClick={save} disabled={createStrategy.isPending || updateStrategy.isPending}>
                    {isCreating ? 'Create strategy' : 'Save changes'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
