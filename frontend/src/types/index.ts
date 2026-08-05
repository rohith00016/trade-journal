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
  /** Max R before first retest of entry; omit if no meaningful retest */
  maxBeforeRetest?: number
  /** Times price returned to entry/BE */
  retestCount?: number
  /** Peak before each retest: [0]=1st, [1]=2nd, … */
  retestPeaks?: number[]
  /** Peak before 2nd retest — synced from retestPeaks[1] */
  maxAfterFirstRetest?: number
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
  sampleReady: boolean
  /** keep = required; cut = remove; review = optional; needs_data = keep logging */
  verdict: 'keep' | 'review' | 'cut' | 'needs_data'
  verdictHint: string
}

export interface MaxRrInsights {
  sample: number
  avgMaxRr: number | null
  medianMaxRr: number | null
  hitRates: Array<{
    thresholdR: number
    label: string
    count: number
    pct: number
  }>
  peakBuckets: Array<{
    fromR: number
    toR: number | null
    label: string
    count: number
    pct: number
  }>
  mostCommonPeak?: {
    label: string
    count: number
    pct: number
  }
  note: string
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
  maxRr: MaxRrInsights
}

export type InsightsSource = 'taken' | 'not_taken' | 'combined'

export interface BestTimeSlot {
  startMin: number
  label: string
  count: number
  winRate: number | null
  withMaxSample: number
  hitRates: Array<{
    thresholdR: number
    label: string
    count: number
    pct: number | null
  }>
  /** Highest of 1 / 1.2 / 1.5 / 2R that still hits ≥60% (fills often) */
  suggestedTpR: number | null
  expectancy: number | null
}

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
  bestTimes: {
    slots15: BestTimeSlot[]
    slots30: BestTimeSlot[]
    slots60: BestTimeSlot[]
  }
  bestSlot: {
    label: string
    count: number
    winRate: number | null
    suggestedTpR: number | null
    hitRates: BestTimeSlot['hitRates']
    expectancy: number | null
  } | null
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
  retestContinuation?: {
    afterFirstRetest: {
      sample: number
      withPeaksSample: number
      continuedToHigherMaxPct: number | null
      avgExtraR: number | null
      winRate: number | null
      note: string
    }
    secondLegLogged: number
    medianMaxAfterFirstRetest: number | null
  }
  secondLegBe?: {
    sample: number
    scoredSample: number
    medianMaxAfterFirstRetest: number | null
    suggestedBeR: number | null
    beVerdict: 'protect' | 'hold' | null
    beDeltaExpectancy: number | null
    hint: string | null
    note: string
  }
}

export interface PlaybookResponse {
  source: InsightsSource
  filters: {
    slotMinutes: 15 | 30 | 60
    startMin: number | null
    setupIndex: number | null
    timeLabel: string
    setupLabel: string
  }
  options: {
    times: Array<{ startMin: number; label: string; count: number }>
    setupIndexes: Array<{ setupIndex: number; count: number }>
  }
  slice: {
    count: number
    winRate: number | null
    expectancy: number | null
    withMaxSample: number
    hitRates: BestTimeSlot['hitRates']
    suggestedTpR: number | null
    suggestedBeR: number | null
    /** Trades with maxBeforeRetest ≥ 0.5R */
    withRetestSample: number
    medianMaxBeforeRetest: number | null
    beScoredSample: number
    beLevels: Array<{
      levelR: number
      triggered: number
      lossesSaved: number
      winnersCut: number
      savedR: number
      cutR: number
      deltaExpectancy: number | null
    }>
    beSource: 'outcome' | 'retest' | 'max_rr_fallback' | null
    beVerdict: 'protect' | 'hold' | null
    beDeltaExpectancy: number | null
    beHint: string | null
    checklistImpact: ChecklistImpactRow[]
    note: string | null
  }
  setupBreakdown: Array<{
    setupIndex: number
    count: number
    winRate: number | null
    expectancy: number | null
    suggestedTpR: number | null
  }>
  timeBreakdown: Array<{
    startMin: number
    label: string
    count: number
    winRate: number | null
    expectancy: number | null
    suggestedTpR: number | null
  }>
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}
