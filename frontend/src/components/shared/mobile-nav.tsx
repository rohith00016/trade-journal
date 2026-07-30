import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  ChartColumn,
  LayoutDashboard,
  Map,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/playbook', label: 'Playbook', icon: Map },
  { to: '/strategies', label: 'Rules', icon: Target },
  { to: '/analytics', label: 'Stats', icon: ChartColumn },
]

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5 gap-0.5 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] text-muted-foreground transition-colors',
                isActive && 'bg-primary/10 text-primary'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
