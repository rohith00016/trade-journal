import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Account,
  DashboardAnalytics,
  InsightsSource,
  JournalEntry,
  JournalListResponse,
  PlaybookResponse,
  Strategy,
  Trade,
  UnifiedInsights,
} from '@/types'

function invalidateJournal(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['journal'] })
  qc.invalidateQueries({ queryKey: ['trades'] })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['insights'] })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api<Account[]>('/accounts'),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Account>) =>
      api<Account>('/accounts', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useStrategies(includeArchived = false) {
  return useQuery({
    queryKey: ['strategies', includeArchived],
    queryFn: () =>
      api<Strategy[]>(
        `/strategies${includeArchived ? '?includeArchived=true' : ''}`
      ),
  })
}

export function useStrategy(id?: string) {
  return useQuery({
    queryKey: ['strategies', id],
    queryFn: () => api<Strategy>(`/strategies/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: unknown) =>
      api<Strategy>('/strategies', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })
}

export function useUpdateStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api<Strategy>(`/strategies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })
}

export function useArchiveStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<Strategy>(`/strategies/${id}/archive`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })
}

export function useDuplicateStrategy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<Strategy>(`/strategies/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })
}

export function useCreateStrategyVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: unknown }) =>
      api<Strategy>(`/strategies/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  })
}

export function useJournalEntries(
  params?: Record<string, string | number | undefined>
) {
  const search = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') search.set(k, String(v))
    })
  }
  const qs = search.toString()
  return useQuery({
    queryKey: ['journal', params],
    queryFn: () =>
      api<JournalListResponse>(`/journal${qs ? `?${qs}` : ''}`),
  })
}

export function useCreateJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: unknown) =>
      api<JournalEntry>('/journal', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateJournal(qc),
  })
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api<JournalEntry>(`/journal/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateJournal(qc),
  })
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<null>(`/journal/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateJournal(qc),
  })
}

export type JournalExportPayload = {
  exportedAt: string
  source: InsightsSource
  count: number
  entries: Omit<JournalEntry, 'screenshots'>[]
}

export function useExportJournal() {
  return useMutation({
    mutationFn: async (params?: Record<string, string | undefined>) => {
      const search = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== '') search.set(k, v)
        })
      }
      const qs = search.toString()
      return api<JournalExportPayload>(`/journal/export${qs ? `?${qs}` : ''}`)
    },
  })
}

/** Dashboard still expects trade-shaped taken entries */
export function useTrades(params?: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ['trades', params],
    queryFn: async () => {
      const search = new URLSearchParams({ source: 'taken' })
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== '') search.set(k, String(v))
        })
      }
      const data = await api<JournalListResponse>(`/journal?${search}`)
      return {
        items: data.items as unknown as Trade[],
        total: data.total,
        page: data.page,
        pages: data.pages,
      }
    },
  })
}

export function useCreateTrade() {
  const create = useCreateJournalEntry()
  return {
    ...create,
    mutateAsync: (body: unknown) =>
      create.mutateAsync({ ...(body as object), source: 'taken' }),
  }
}

export function useUpdateTrade() {
  const update = useUpdateJournalEntry()
  return {
    ...update,
    mutateAsync: ({ id, body }: { id: string; body: unknown }) =>
      update.mutateAsync({
        id,
        body: { ...(body as object), source: 'taken' },
      }),
  }
}

export function useDeleteTrade() {
  return useDeleteJournalEntry()
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardAnalytics>('/analytics/dashboard'),
  })
}

export function useInsights(source: InsightsSource = 'combined') {
  return useQuery({
    queryKey: ['insights', source],
    queryFn: () =>
      api<UnifiedInsights>(`/analytics/insights?source=${source}`),
  })
}

export type PlaybookParams = {
  source: InsightsSource
  slotMinutes: 15 | 30 | 60
  startMin: number | null
  setupIndex: number | null
}

export function usePlaybook(params: PlaybookParams) {
  const q = new URLSearchParams({
    source: params.source,
    slotMinutes: String(params.slotMinutes),
  })
  if (params.startMin != null) q.set('startMin', String(params.startMin))
  if (params.setupIndex != null) q.set('setupIndex', String(params.setupIndex))

  return useQuery({
    queryKey: ['playbook', params],
    queryFn: () => api<PlaybookResponse>(`/analytics/playbook?${q}`),
  })
}

export type AiInsightsResponse = {
  markdown: string
  model: string
  usedGemini: boolean
  sample: number
  recommendedTpR?: number | null
  recommendedBeR?: number | null
  beVerdict?: 'protect' | 'hold' | null
}

export function useAiInsights() {
  return useMutation({
    mutationFn: (source: InsightsSource) =>
      api<AiInsightsResponse>('/analytics/ai-insights', {
        method: 'POST',
        body: JSON.stringify({ source }),
      }),
  })
}

export type CoachChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type CoachChatResponse = {
  reply: string
  model: string
  sample: number
  source: InsightsSource
}

export function useCoachChat() {
  return useMutation({
    mutationFn: (input: {
      message: string
      source: InsightsSource
      history: CoachChatMessage[]
    }) =>
      api<CoachChatResponse>('/analytics/coach-chat', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  })
}
