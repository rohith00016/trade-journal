import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from './app-sidebar'
import { CommandPalette } from './command-palette'
import { MobileNav } from './mobile-nav'
import { NewTradeFab } from './new-trade-fab'
import { PageTransition } from './page-transition'
import { TopBar } from './top-bar'

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <TopBar onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-auto p-5 md:p-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <NewTradeFab />
      <MobileNav />
    </div>
  )
}
