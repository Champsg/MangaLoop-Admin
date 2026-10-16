import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Users as UsersIcon,
  Search,
  BookOpen,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Trash2,
  RefreshCw,
  Loader2,
  Calendar,
  Filter,
  X,
  ArrowUpDown,
  UserPlus,
  Activity,
  Clock,
  Smartphone,
  Globe,
  Wifi,
  Radio,
  Copy,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { formatDate, timeAgo } from '@/lib/utils'
import { getCountryFlag, isSessionOnline } from './RecentUsers'

const ADMIN_EMAIL = 'shujaatbhat8@gmail.com'

interface AdminUser {
  id: string
  email: string
  full_name: string
  manga_count: number
  joined_at: string
  banned: boolean
  is_admin?: boolean
  // Session metadata
  last_device?: string
  last_ip?: string
  last_country?: string
  last_country_code?: string
  last_city?: string
  last_active_at?: string
  last_screen?: string
}

type DateFilterOption = 'all' | 'today' | 'yesterday' | '7d' | '30d'
type RoleFilterOption = 'all' | 'admin' | 'user'
type StatusFilterOption = 'all' | 'active' | 'banned'
type LibraryFilterOption = 'all' | 'has_manga' | 'empty'
type SortOption = 'joined_desc' | 'joined_asc' | 'manga_desc' | 'manga_asc' | 'name_asc' | 'name_desc'

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Chart settings
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '14d' | '30d' | 'all'>('14d')

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilterOption>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all')
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilterOption>('all')
  const [sortBy, setSortBy] = useState<SortOption>('joined_desc')

  const loadUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_admin_users')
    if (error) {
      toast.error('Failed to load users: ' + error.message)
    } else {
      let rawUsers: AdminUser[] = data || []
      try {
        const { data: sessionData } = await supabase
          .from('user_sessions')
          .select('*')
          .order('last_active_at', { ascending: false })

        if (sessionData && sessionData.length > 0) {
          const sessionMap = new Map<string, any>()
          sessionData.forEach((s: any) => {
            if (s.user_id && !sessionMap.has(s.user_id)) {
              sessionMap.set(s.user_id, s)
            }
            if (s.user_email && !sessionMap.has(s.user_email.toLowerCase())) {
              sessionMap.set(s.user_email.toLowerCase(), s)
            }
          })

          rawUsers = rawUsers.map((u) => {
            const s = sessionMap.get(u.id) || (u.email ? sessionMap.get(u.email.toLowerCase()) : null)
            if (s) {
              return {
                ...u,
                last_device: s.device_name || s.device_model || s.platform,
                last_ip: s.ip_address,
                last_country: s.country,
                last_country_code: s.country_code,
                last_city: s.city,
                last_active_at: s.last_active_at,
                last_screen: s.last_screen,
              }
            }
            return u
          })
        }
      } catch {
        // sessions fetch optional
      }
      setUsers(rawUsers)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // KPI Calculations
  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    let todayCount = 0
    let weekCount = 0
    let monthCount = 0

    users.forEach(u => {
      if (!u.joined_at) return
      const joinDate = new Date(u.joined_at)
      const dateKey = u.joined_at.split('T')[0]

      if (dateKey === todayStr) todayCount++

      const diffDays = (now.getTime() - joinDate.getTime()) / (1000 * 3600 * 24)
      if (diffDays <= 7) weekCount++
      if (diffDays <= 30) monthCount++
    })

    return {
      total: users.length,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      banned: users.filter(u => u.banned).length,
      admins: users.filter(u => u.is_admin || u.email === ADMIN_EMAIL).length,
    }
  }, [users])

  // Chart Data Calculation
  const signupChartData = useMemo(() => {
    if (!users || users.length === 0) return []

    if (chartTimeframe === 'all') {
      const counts: Record<string, number> = {}
      users.forEach(u => {
        if (!u.joined_at) return
        const key = u.joined_at.split('T')[0]
        counts[key] = (counts[key] || 0) + 1
      })
      const sortedKeys = Object.keys(counts).sort()
      return sortedKeys.map(k => ({
        dateRaw: k,
        date: new Date(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        users: counts[k],
      }))
    }

    const daysCount = chartTimeframe === '7d' ? 7 : chartTimeframe === '14d' ? 14 : 30
    const dayMap: Record<string, number> = {}

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      dayMap[key] = 0
    }

    users.forEach(u => {
      if (!u.joined_at) return
      const key = u.joined_at.split('T')[0]
      if (dayMap[key] !== undefined) {
        dayMap[key]++
      }
    })

    return Object.entries(dayMap).map(([k, count]) => ({
      dateRaw: k,
      date: new Date(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      users: count,
    }))
  }, [users, chartTimeframe])

  // Filtering & Sorting Logic
  const filteredUsers = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    return users
      .filter(u => {
        // 1. Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const nameMatch = (u.full_name || '').toLowerCase().includes(q)
          const emailMatch = (u.email || '').toLowerCase().includes(q)
          if (!nameMatch && !emailMatch) return false
        }

        // 2. Date Filter
        if (dateFilter !== 'all') {
          if (!u.joined_at) return false
          const joinDateKey = u.joined_at.split('T')[0]
          const joinDateTime = new Date(u.joined_at).getTime()
          const diffDays = (now.getTime() - joinDateTime) / (1000 * 3600 * 24)

          if (dateFilter === 'today' && joinDateKey !== todayStr) return false
          if (dateFilter === 'yesterday' && joinDateKey !== yesterdayStr) return false
          if (dateFilter === '7d' && diffDays > 7) return false
          if (dateFilter === '30d' && diffDays > 30) return false
        }

        // 3. Role Filter
        if (roleFilter !== 'all') {
          const isAdminUser = !!u.is_admin || u.email === ADMIN_EMAIL
          if (roleFilter === 'admin' && !isAdminUser) return false
          if (roleFilter === 'user' && isAdminUser) return false
        }

        // 4. Status Filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'banned' && !u.banned) return false
          if (statusFilter === 'active' && u.banned) return false
        }

        // 5. Library Filter
        if (libraryFilter !== 'all') {
          const count = u.manga_count || 0
          if (libraryFilter === 'has_manga' && count === 0) return false
          if (libraryFilter === 'empty' && count > 0) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'joined_desc') {
          return new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime()
        }
        if (sortBy === 'joined_asc') {
          return new Date(a.joined_at || 0).getTime() - new Date(b.joined_at || 0).getTime()
        }
        if (sortBy === 'manga_desc') {
          return (b.manga_count || 0) - (a.manga_count || 0)
        }
        if (sortBy === 'manga_asc') {
          return (a.manga_count || 0) - (b.manga_count || 0)
        }
        if (sortBy === 'name_asc') {
          return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '')
        }
        if (sortBy === 'name_desc') {
          return (b.full_name || b.email || '').localeCompare(a.full_name || a.email || '')
        }
        return 0
      })
  }, [users, searchQuery, dateFilter, roleFilter, statusFilter, libraryFilter, sortBy])

  // Count of active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchQuery.trim()) count++
    if (dateFilter !== 'all') count++
    if (roleFilter !== 'all') count++
    if (statusFilter !== 'all') count++
    if (libraryFilter !== 'all') count++
    return count
  }, [searchQuery, dateFilter, roleFilter, statusFilter, libraryFilter])

  const resetFilters = () => {
    setSearchQuery('')
    setDateFilter('all')
    setRoleFilter('all')
    setStatusFilter('all')
    setLibraryFilter('all')
    setSortBy('joined_desc')
  }

  // User Actions
  const manageUser = async (userId: string, action: 'ban' | 'unban' | 'delete') => {
    setActionLoading(userId)
    try {
      if (action === 'delete') {
        if (!confirm('Delete this user permanently?')) {
          setActionLoading(null)
          return
        }
        // Try RPC first
        const { error: rpcError } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId })
        if (rpcError) {
          // Fallback to client auth.admin
          const { error: authError } = await supabase.auth.admin.deleteUser(userId)
          if (authError) {
            throw new Error(rpcError.message || authError.message || 'Failed to delete user. Make sure delete_user_by_admin RPC is created in Supabase.')
          }
        }
        setUsers(prev => prev.filter(u => u.id !== userId))
        toast.success('User deleted successfully')
      } else {
        const isBanned = action === 'ban'
        // Try RPC first (SECURITY DEFINER allows updating without RLS restriction)
        const { error: rpcError } = await supabase.rpc('update_user_ban_status', {
          target_user_id: userId,
          is_banned_status: isBanned,
        })

        if (rpcError) {
          // Fallback to direct table update with returned rows check
          const { data, error: updateError } = await supabase
            .from('profiles')
            .update({ banned: isBanned })
            .eq('id', userId)
            .select()

          if (updateError) throw updateError
          if (!data || data.length === 0) {
            throw new Error(
              'RLS prevented updating user profile. Please run supabase-admin-users-fix.sql in Supabase SQL Editor.'
            )
          }
        }

        setUsers(prev => prev.map(u => (u.id === userId ? { ...u, banned: isBanned } : u)))
        toast.success(`User ${isBanned ? 'banned' : 'unbanned'} successfully`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    }
    setActionLoading(null)
  }

  const toggleAdmin = async (userId: string, current: boolean) => {
    const target = users.find(u => u.id === userId)
    if (target?.email === ADMIN_EMAIL) {
      toast.error('Cannot modify super admin status')
      return
    }
    setActionLoading(userId)
    const { error } = await supabase.rpc('update_user_admin_status', {
      target_user_id: userId,
      is_admin_status: !current,
    })
    if (error) {
      toast.error(error.message || 'Failed to update admin status')
    } else {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, is_admin: !current } : u)))
      toast.success(`Admin privileges ${!current ? 'granted' : 'revoked'}`)
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Users Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, filter, and manage platform registered accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            className="rounded-xl gap-2 cursor-pointer border-border/60 hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Data
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Users</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <UsersIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold">{stats.total.toLocaleString()}</div>
          <div className="mt-1 text-xs text-muted-foreground">Registered on platform</div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Joined Today</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <UserPlus className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-500">+{stats.today}</div>
          <div className="mt-1 text-xs text-muted-foreground">New signups today</div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Joined Last 7 Days</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-purple-500">+{stats.week}</div>
          <div className="mt-1 text-xs text-muted-foreground">Past 7 days volume</div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Joined Last 30 Days</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-500">+{stats.month}</div>
          <div className="mt-1 text-xs text-muted-foreground">Past month growth</div>
        </div>
      </div>

      {/* User Signups Chart */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Activity className="h-4 w-4 text-primary" />
            Daily User Signups Chart
          </CardTitle>
          <div className="flex items-center gap-1 rounded-xl bg-secondary p-1 text-xs">
            {(['7d', '14d', '30d', 'all'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setChartTimeframe(tf)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  chartTimeframe === tf
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf === '7d' ? '7 Days' : tf === '14d' ? '14 Days' : tf === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={signupChartData}>
              <defs>
                <linearGradient id="userSignupGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={false}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: any) => [`${value} Users Joined`, 'New Users']}
              />
              <Area
                type="monotone"
                dataKey="users"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#userSignupGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filter Control Bar */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-4">
        {/* Top Row: Search + Sort */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 rounded-xl bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="h-10 rounded-xl border border-border/60 bg-secondary/50 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="joined_desc">Newest Joined First</option>
              <option value="joined_asc">Oldest Joined First</option>
              <option value="manga_desc">Library: High to Low</option>
              <option value="manga_asc">Library: Low to High</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>
          </div>
        </div>

        {/* Bottom Row: Quick Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-2">
            <Filter className="h-3.5 w-3.5 text-primary" />
            Filters:
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as DateFilterOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              dateFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">📅 Joined: All Time</option>
            <option value="today">⚡ Signed Up Today</option>
            <option value="yesterday">🕒 Signed Up Yesterday</option>
            <option value="7d">📆 Joined Last 7 Days</option>
            <option value="30d">🗓️ Joined Last 30 Days</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as RoleFilterOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              roleFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">👑 Role: All</option>
            <option value="admin">🛡️ Admins Only</option>
            <option value="user">👤 Users Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilterOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              statusFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">🟢 Status: All</option>
            <option value="active">✅ Active Only</option>
            <option value="banned">⛔ Banned Only</option>
          </select>

          {/* Library Filter */}
          <select
            value={libraryFilter}
            onChange={e => setLibraryFilter(e.target.value as LibraryFilterOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              libraryFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">📚 Library: All</option>
            <option value="has_manga">📖 Has Manga Tracked</option>
            <option value="empty">📭 Empty Library</option>
          </select>

          {/* Active filter count & Reset */}
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg gap-1.5 ml-auto cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters ({activeFiltersCount})
            </Button>
          )}
        </div>

        {/* Results Counter Bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            Showing <strong className="text-foreground font-semibold">{filteredUsers.length}</strong> of{' '}
            <strong className="text-foreground font-semibold">{users.length}</strong> users
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-primary font-medium">Filtered results applied</span>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left min-w-[1100px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[220px]">
                  User Profile
                </th>
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[220px]">
                  Email
                </th>
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center min-w-[90px]">
                  Library
                </th>
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[140px]">
                  Joined Date
                </th>
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[240px]">
                  Last Device &amp; Location
                </th>
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center min-w-[120px]">
                  Role
                </th>
                <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right min-w-[160px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredUsers.map(u => {
                const isSuperAdmin = u.email === ADMIN_EMAIL
                const isTodayUser = u.joined_at && u.joined_at.split('T')[0] === new Date().toISOString().split('T')[0]
                const online = isSessionOnline(u.last_active_at)

                return (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-muted/20 ${u.banned ? 'opacity-60 bg-rose-500/5' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 shadow-xs">
                            {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          {online && (
                            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground" title={u.full_name || 'User'}>
                              {u.full_name || 'User'}
                            </span>
                            {isTodayUser && (
                              <Badge variant="success" className="text-[9px] px-1.5 py-0 font-bold uppercase shrink-0">
                                New Today
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 group/id">
                            <span className="text-[11px] text-muted-foreground font-mono" title={`User ID: ${u.id}`}>
                              ID: {u.id.substring(0, 8)}...
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(u.id)
                                toast.success('Copied full User ID to clipboard')
                              }}
                              className="text-muted-foreground/60 hover:text-primary transition-colors cursor-pointer"
                              title="Copy full User ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-foreground/80 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span title={u.email}>{u.email}</span>
                        {u.email && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(u.email)
                              toast.success('Email copied to clipboard')
                            }}
                            className="text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer shrink-0"
                            title="Copy email"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge
                        variant={u.manga_count > 0 ? 'secondary' : 'outline'}
                        className="font-bold px-2 py-0.5"
                      >
                        <BookOpen className="h-3 w-3 mr-1 opacity-70" />
                        {u.manga_count || 0}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{formatDate(u.joined_at)}</span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(u.joined_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {u.last_device || u.last_country || u.last_ip ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 font-semibold text-foreground" title={u.last_device}>
                            <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{u.last_device || 'Device'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="text-sm leading-none">{getCountryFlag(u.last_country_code)}</span>
                            <span title={`${u.last_city ? `${u.last_city}, ` : ''}${u.last_country || ''}`}>
                              {u.last_city ? `${u.last_city}, ` : ''}{u.last_country || ''}
                            </span>
                            {u.last_ip && (
                              <span className="font-mono text-[10px] bg-secondary/60 px-1 py-0.2 rounded" title="IP Address">
                                ({u.last_ip})
                              </span>
                            )}
                          </div>
                          {u.last_active_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Active {timeAgo(u.last_active_at)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px] italic">No telemetry yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {isSuperAdmin ? (
                        <Badge variant="warning" className="font-bold shadow-xs">
                          Super Admin
                        </Badge>
                      ) : u.is_admin ? (
                        <Badge variant="success" className="font-bold shadow-xs">
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground font-semibold">
                          User
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {actionLoading === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            {!isSuperAdmin && (
                              <Button
                                variant={u.is_admin ? 'destructive' : 'default'}
                                size="sm"
                                onClick={() => toggleAdmin(u.id, !!u.is_admin)}
                                className="rounded-lg h-7 px-2.5 text-[10px] font-bold gap-1 cursor-pointer shrink-0"
                              >
                                {u.is_admin ? (
                                  <>
                                    <ShieldCheck className="h-3 w-3" /> Revoke
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-3 w-3" /> Grant
                                  </>
                                )}
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 rounded-lg cursor-pointer shrink-0 ${
                                u.banned
                                  ? 'text-emerald-500 hover:bg-emerald-500/10'
                                  : 'text-amber-500 hover:bg-amber-500/10'
                              }`}
                              onClick={() => manageUser(u.id, u.banned ? 'unban' : 'ban')}
                              title={u.banned ? 'Unban user' : 'Ban user'}
                            >
                              {u.banned ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
                              onClick={() => manageUser(u.id, 'delete')}
                              title="Delete user"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <UsersIcon className="mx-auto mb-3 h-10 w-10 opacity-30 text-primary" />
                    <p className="font-bold text-foreground text-base">No users found matching your filters</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting or clearing your search and filter criteria.</p>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={resetFilters}
                        className="mt-4 rounded-xl font-bold text-xs gap-2 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" /> Reset All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
