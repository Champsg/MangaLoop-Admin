import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Users,
  Radio,
  Flag,
  Bell,
  AlertTriangle,
  Settings,
  LogOut,
  BookOpen,
  X,
  ChevronRight,
  Inbox,
  Megaphone,
  FolderHeart,
  Image, Crown,
} from 'lucide-react'

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Manga Requests', href: '/requests', icon: Inbox },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Recent Users', href: '/recent-users', icon: Radio, isLive: true },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Collections', href: '/collections', icon: FolderHeart },
  { name: 'Scrapbook Moderation', href: '/scrapbook', icon: Image },
  { name: 'Admin Pick', href: '/admin-pick', icon: Crown },
  { name: 'Feature Flags', href: '/feature-flags', icon: Flag },
  { name: 'Site Notice', href: '/site-notice', icon: Megaphone },
  { name: 'Error Logs', href: '/errors', icon: AlertTriangle },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ open, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'AD'

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/50 bg-card transition-all duration-300 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-20' : 'w-72'
        )}
      >
        {/* Header */}
        <div className={cn('flex h-16 items-center justify-between', collapsed ? 'px-4 justify-center' : 'px-6')}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <BookOpen className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold tracking-tight truncate">MangaLoop</h1>
                <p className="text-[10px] font-medium text-muted-foreground truncate">Admin Dashboard</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                    collapsed ? 'justify-center px-2' : 'px-3',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-transform duration-200',
                      !isActive && 'group-hover:scale-110'
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 flex items-center gap-2 truncate">
                        {item.name}
                        {item.isLive && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                      </span>
                      {isActive && <ChevronRight className="h-4 w-4 opacity-60 shrink-0" />}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* Collapse toggle button for Desktop */}
        {onToggleCollapse && (
          <div className="hidden lg:flex px-3 py-2 justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className={cn(
                'w-full text-xs text-muted-foreground hover:text-foreground h-8 cursor-pointer rounded-lg',
                collapsed ? 'px-0 justify-center' : 'justify-between px-3'
              )}
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {!collapsed && <span>Collapse Sidebar</span>}
              <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', !collapsed && 'rotate-180')} />
            </Button>
          </div>
        )}

        {/* Footer â€” User Info */}
        <div className="p-3">
          <div className={cn('flex items-center gap-3 rounded-xl bg-accent/50 p-2.5', collapsed && 'justify-center p-2')}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold">{user?.email?.split('@')[0] ?? 'Admin'}</p>
                <p className="truncate text-[9px] text-muted-foreground">{user?.email ?? ''}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-7 w-7 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 cursor-pointer"
              onClick={signOut}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}


