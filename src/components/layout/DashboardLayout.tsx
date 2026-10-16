import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border/50 bg-card/50 px-4 backdrop-blur-sm lg:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">ML</span>
              </div>
              <span className="text-sm font-bold">MangaLoop Admin</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="w-full max-w-[1850px] mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
