export type AccountType = 'live' | 'demo' | 'prop'
export type TradeDirection = 'long' | 'short'
export type TradeSession = 'asia' | 'london' | 'newyork' | 'overlap' | 'other'
export type PsychologyTag =
  | 'fomo'
  | 'revenge'
  | 'early_exit'
  | 'late_entry'
  | 'oversized_risk'
  | 'rule_violation'
  | 'moving_stop'

export interface User {
  id: string
  name: string
  email: string
  preferences?: {
    timezone: string
    currency: string
    defaultRisk: number
  }
  avatarUrl?: string
}

export interface Account {
  _id: string
  name: string
  type: AccountType
  currency: string
  startingBalance: number
  isActive: boolean
  notes?: string
}

export interface ChecklistItem {
  _id: string
  label: string
  description?: string
  order: number
  isRequired: boolean
}

export interface ChecklistCategory {
  _id: string
  name: string
  order: number
  items: ChecklistItem[]
}

export interface Strategy {
  _id: string
  name: string
  description?: string
  markets: string[]
  timeframes: string[]
  rules: {
    riskRules: string[]
    tpRules: string[]
    breakEvenRules: string[]
  }
  categories: ChecklistCategory[]
  version: number
  parentStrategyId?: string
  rootStrategyId?: string
  isArchived: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ChecklistResponse {
  categoryId: string
  categoryName: string
  itemId: string
  itemLabel: string
  checked: boolean
}

export type SetupResult = 'win' | 'loss' | 'be'

export interface ReviewedSetup {
  _id?: string
  time: string
  strategyId?: string
  strategyName?: string
  valid: boolean
  taken: boolean
  /** Required when saving — win/loss/BE of the chart setup (you did not take it). */
  result?: SetupResult
  maximumRr?: number
  screenshot?: string
  notes?: string
  checklist: ChecklistResponse[]
}

export interface DayReview {
  _id?: string
  date: string
  marketNotes?: string
  emotionalState?: string
  grade?: 'A' | 'B' | 'C' | 'D' | 'F'
  setups: ReviewedSetup[]
  createdAt?: string
  updatedAt?: string
}

export type JournalSource = 'taken' | 'not_taken'
export type SetupOutcome = 'win' | 'loss' | 'be'

export interface JournalEntry {
  _id: string
  source: JournalSource
  date: string
  accountId?: string
  strategyId?: string
  strategyVersion?: number
  strategyName?: string
  symbol?: string
  direction?: TradeDirection
  entry?: number
  exit?: number
  stopLoss?: number
  takeProfit?: number
  risk?: number
  contracts?: number
  resultUsd?: number
  resultR?: number
  maximumRr?: number
  commission?: number
  session?: TradeSession
  screenshots: string[]
  notes?: string
  checklist: ChecklistResponse[]
  psychologyTags: PsychologyTag[]
  valid?: boolean
  outcome?: SetupOutcome
  createdAt: string
  updatedAt?: string
}

/** @deprecated Prefer JournalEntry — kept for dashboard typing */
export interface Trade {
  _id: string
  accountId: string
  strategyId?: string
  strategyVersion?: number
  strategyName?: string
  date: string
  symbol: string
  direction: TradeDirection
  entry?: number
  exit?: number
  stopLoss?: number
  takeProfit?: number
  risk: number
  contracts: number
  resultUsd: number
  resultR: number
  maximumRr?: number
  commission: number
  session: TradeSession
  screenshots: string[]
  notes?: string
  checklist: ChecklistResponse[]
  psychologyTags: PsychologyTag[]
  createdAt: string
}

export interface JournalListResponse {
  items: JournalEntry[]
  total: number
  page: number
  pages: number
  limit: number
  counts: {
    taken: number
    notTaken: number
    combined: number
  }
}

export interface PerformanceSummary {
  totalTrades: number
  winners: number
  losers: number
  breakevens: number
  winRate: number
  totalPnl: number
  totalR: number
  profitFactor: number | null
  expectancy: number
  averageWin: number
  averageLoss: number
  averageR: number
  maxDrawdownR: number
  currentStreak: number
  bestStrategy?: { name: string; expectancy: number }
  bestHour?: { hour: number; expectancy: number }
}

export interface ChecklistImpactRow {
  categoryName: string
  itemLabel: string
  withCount: number
  withoutCount: number
  withWinRate: number
  withoutWinRate: number
  withExpectancy: number
  withoutExpectancy: number
  deltaWinRate: number
  deltaExpectancy: number
}

export interface DashboardAnalytics {
  performance: PerformanceSummary
  equityCurve: Array<{
    date: string
    equityR: number
    equityUsd: number
    resultR: number
  }>
  calendarHeatmap: Array<{ date: string; pnl: number; r: number; count: number }>
  monthlyPerformance: Array<{ month: string; pnl: number; r: number; trades: number }>
  recentTrades: Trade[]
  checklistImpact: ChecklistImpactRow[]
}

export type InsightsSource = 'taken' | 'not_taken' | 'combined'

export interface UnifiedInsights {
  source: InsightsSource
  counts: {
    taken: number
    notTaken: number
    combined: number
    filtered: number
  }
  summary: {
    winRate: number | null
    avgMaxRr: number | null
    avgResultR: number | null
    avgCapturePct: number | null
    takenWithMaxRr: number
    scoredSample: number
  }
  rrGap: {
    avgMaxRr: number | null
    avgRealizedR: number | null
    avgCapturePct: number | null
    sample: number
    note: string
  }
  sequence: {
    afterFirstWin: {
      secondTradeCount: number
      secondTradeWinRate: number | null
    }
    afterFirstLoss: {
      secondTradeCount: number
      secondTradeWinRate: number | null
    }
    insight: string
  }
  hourBuckets: Array<{
    hour: number
    label: string
    count: number
    takenCount: number
    notTakenCount: number
    winRate: number | null
    avgMaxRr: number | null
    avgResultR: number | null
    sampleForWinRate: number
  }>
  setupIndexBuckets: Array<{
    setupIndex: number
    count: number
    takenCount: number
    notTakenCount: number
    winRate: number | null
    avgMaxRr: number | null
    avgResultR: number | null
  }>
  checklistImpact: ChecklistImpactRow[]
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}
