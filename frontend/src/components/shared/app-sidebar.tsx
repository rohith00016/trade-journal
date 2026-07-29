import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChartColumn,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Target,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/strategies', label: 'Strategies', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn },
]

export function AppSidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-2 py-4 md:flex">
      <div className="mb-6 px-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-foreground">
              TradingJournal
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Pro
            </p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                isActive && 'bg-sidebar-accent text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-zinc-100"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                ) : null}
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator className="my-3" />
      <div className="space-y-2 px-2 pb-1">
        <div className="px-1">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
