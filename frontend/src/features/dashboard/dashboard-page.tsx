import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { BookOpen, LineChart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '@/lib/hooks'
import { formatR, formatUsd, pnlClass } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'profit' | 'loss' | 'neutral'
}) {
  return (
    <motion.div variants={staggerItem} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
      <Card className="hover-lift relative h-full overflow-hidden">
        <CardHeader className="relative pb-2">
          <CardDescription className="text-[11px] uppercase tracking-[0.14em]">
            {label}
          </CardDescription>
          <CardTitle
            className={`font-mono text-2xl tabular-nums tracking-tight ${
              tone === 'profit'
                ? 'text-profit'
                : tone === 'loss'
                  ? 'text-loss'
                  : ''
            }`}
          >
            {value}
          </CardTitle>
        </CardHeader>
        {hint ? (
          <CardContent>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </CardContent>
        ) : null}
      </Card>
    </motion.div>
  )
}

export function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const navigate = useNavigate()

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const p = data.performance
  const pf =
    p.profitFactor == null
      ? p.winners > 0
        ? '∞'
        : '0.00'
      : Number(p.profitFactor).toFixed(2)

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Edge at a glance — R, expectancy, and what is actually working.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
          {p.totalTrades} trades tracked
        </div>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total R"
          value={formatR(p.totalR)}
          tone={p.totalR >= 0 ? 'profit' : 'loss'}
        />
        <MetricCard label="Win rate" value={`${p.winRate}%`} hint={`${p.winners}W / ${p.losers}L`} />
        <MetricCard label="Profit factor" value={pf} />
        <MetricCard label="Expectancy" value={`${p.expectancy}R`} hint="Average R per trade" />
        <MetricCard
          label="Current streak"
          value={`${p.currentStreak > 0 ? '+' : ''}${p.currentStreak}`}
          tone={p.currentStreak > 0 ? 'profit' : p.currentStreak < 0 ? 'loss' : 'neutral'}
        />
        <MetricCard
          label="Best strategy"
          value={p.bestStrategy?.name ?? '—'}
          hint={
            p.bestStrategy
              ? `${p.bestStrategy.expectancy}R expectancy`
              : 'Need 3+ trades per strategy'
          }
        />
        <MetricCard
          label="Best hour (IST)"
          value={p.bestHour ? `${String(p.bestHour.hour).padStart(2, '0')}:00` : '—'}
          hint={
            p.bestHour
              ? `${p.bestHour.expectancy}R expectancy`
              : 'Need 3+ trades per hour'
          }
        />
        <MetricCard
          label="Avg Max RR"
          value={data.maxRr.avgMaxRr != null ? `${data.maxRr.avgMaxRr}R` : '—'}
          hint={
            data.maxRr.sample
              ? `${data.maxRr.sample} trades with Max RR`
              : 'Log Max RR on trades'
          }
        />
        <MetricCard
          label="Most common peak"
          value={data.maxRr.mostCommonPeak?.label ?? '—'}
          hint={
            data.maxRr.mostCommonPeak
              ? `${data.maxRr.mostCommonPeak.count} trades · ${data.maxRr.mostCommonPeak.pct}%`
              : 'Needs Max RR data'
          }
        />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-3">
        <motion.div
          className="xl:col-span-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Equity curve</CardTitle>
              <CardDescription>Cumulative R over time</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {data.equityCurve.length === 0 ? (
                <EmptyState
                  icon={LineChart}
                  title="No equity curve yet"
                  description="Log a few trades to see how your R compounds."
                  actionLabel="Log trade"
                  onAction={() => navigate('/journal?new=1')}
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.equityCurve}>
                    <defs>
                      <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => format(new Date(v), 'MMM d')}
                      stroke="#71717a"
                      fontSize={12}
                    />
                    <YAxis stroke="#71717a" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: '#111113',
                        border: '1px solid #27272a',
                        borderRadius: 8,
                      }}
                      labelFormatter={(v) => format(new Date(String(v)), 'PP')}
                    />
                    <Area
                      type="monotone"
                      dataKey="equityR"
                      stroke="#e4e4e7"
                      fill="url(#equityFill)"
                      strokeWidth={2}
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.45 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Monthly performance</CardTitle>
              <CardDescription>PnL & R by month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.monthlyPerformance.length === 0 ? (
                <EmptyState title="No months yet" description="Performance by month will show here." />
              ) : (
                data.monthlyPerformance.map((m, i) => (
                  <motion.div
                    key={m.month}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 transition-colors hover:bg-muted/20"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.month}</p>
                      <p className="text-xs text-muted-foreground">{m.trades} trades</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm ${pnlClass(m.pnl)}`}>
                        {formatUsd(m.pnl)}
                      </p>
                      <p className={`font-mono text-xs ${pnlClass(m.r)}`}>{formatR(m.r)}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.45 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Calendar heatmap</CardTitle>
              <CardDescription>Daily R intensity</CardDescription>
            </CardHeader>
            <CardContent>
              {data.calendarHeatmap.length === 0 ? (
                <EmptyState title="No trade days yet" description="Heatmap fills as you journal." />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {data.calendarHeatmap.slice(-28).map((d, i) => (
                    <motion.div
                      key={d.date}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.02 * i }}
                      whileHover={{ scale: 1.04 }}
                      className="rounded-xl border border-border/50 p-3 transition-shadow hover:shadow-md"
                      style={{
                        background:
                          d.r > 0
                            ? `rgba(8, 153, 129, ${Math.min(0.45, Math.abs(d.r) * 0.12)})`
                            : d.r < 0
                              ? `rgba(242, 54, 69, ${Math.min(0.45, Math.abs(d.r) * 0.12)})`
                              : undefined,
                      }}
                    >
                      <p className="text-xs text-muted-foreground">{d.date.slice(5)}</p>
                      <p className={`font-mono text-sm ${pnlClass(d.r)}`}>{formatR(d.r)}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.45 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Recent trades</CardTitle>
              <CardDescription>Latest journal entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentTrades.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No trades yet"
                  description="Start journaling to unlock expectancy insights."
                  actionLabel="Log first trade"
                  onAction={() => navigate('/journal?new=1')}
                />
              ) : (
                data.recentTrades.map((t, i) => (
                  <motion.div
                    key={t._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-muted/20"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{t.symbol}</p>
                        <Badge variant={t.direction === 'long' ? 'profit' : 'loss'}>
                          {t.direction}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.strategyName || 'No strategy'} ·{' '}
                        {format(new Date(t.date), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-sm ${pnlClass(t.resultR)}`}>
                        {formatR(t.resultR)}
                      </p>
                      <p className={`font-mono text-xs ${pnlClass(t.resultUsd)}`}>
                        {formatUsd(t.resultUsd)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
