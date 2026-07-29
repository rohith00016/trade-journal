import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Command } from 'cmdk'
import {
  BookOpen,
  ChartColumn,
  LayoutDashboard,
  Target,
} from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/strategies', label: 'Strategies', icon: Target },
  { to: '/journal?new=1', label: 'Log taken trade', icon: BookOpen },
  { to: '/journal?new=not-taken', label: 'Log not-taken', icon: BookOpen },
  { to: '/strategies?new=1', label: 'New strategy', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: ChartColumn },
]

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close command palette"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-xl"
          >
            <Command
              className="overflow-hidden rounded-2xl border border-border/80 bg-popover/95 shadow-2xl backdrop-blur-xl"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onOpenChange(false)
              }}
            >
              <Command.Input
                placeholder="Jump to a page or action…"
                className="h-13 w-full border-b border-border bg-transparent px-4 py-4 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <Command.List className="max-h-80 overflow-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No results.
                </Command.Empty>
                {links.map((link) => (
                  <Command.Item
                    key={link.to + link.label}
                    value={link.label}
                    onSelect={() => {
                      navigate(link.to)
                      onOpenChange(false)
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors aria-selected:bg-accent"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
                      <link.icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    {link.label}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
