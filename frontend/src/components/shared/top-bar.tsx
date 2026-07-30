import { Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/journal': 'Journal',
  '/strategies': 'Strategies',
  '/playbook': 'Playbook',
  '/analytics': 'Analytics',
}

export function TopBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'TradingJournal Pro'

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
      <p className="font-display text-sm font-semibold md:hidden">{title}</p>
      <div className="hidden text-xs text-muted-foreground md:block">
        Improve decisions with data — not guesswork
      </div>
      <button
        type="button"
        onClick={onOpenCommand}
        className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-[#363a45] hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
    </header>
  )
}
