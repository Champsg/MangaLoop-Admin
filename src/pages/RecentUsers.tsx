import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Smartphone,
  Laptop,
  Globe,
  MapPin,
  Wifi,
  Search,
  RefreshCw,
  Clock,
  User,
  Shield,
  Eye,
  Copy,
  ExternalLink,
  Filter,
  X,
  ArrowUpDown,
  Monitor,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertCircle,
  Radio,
  Share2,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils'

export interface UserSession {
  id: string
  session_id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  avatar_url: string | null
  is_guest: boolean
  device_name: string | null
  device_model: string | null
  platform: string | null
  os_version: string | null
  app_version: string | null
  browser: string | null
  screen_resolution: string | null
  user_agent: string | null
  ip_address: string | null
  country: string | null
  country_code: string | null
  region: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  isp: string | null
  last_screen: string | null
  session_count: number | null
  first_seen: string
  last_active_at: string
  created_at: string
}

type TimeframeOption = 'all' | 'now' | '1h' | 'today' | '7d' | '30d'
type PlatformFilterOption = 'all' | 'Android' | 'iOS' | 'Web' | 'Windows' | 'macOS'
type UserTypeOption = 'all' | 'registered' | 'guest'
type SortOption = 'active_desc' | 'active_asc' | 'country_asc' | 'device_asc' | 'name_asc'

/** Get emoji flag from 2-letter country code */
export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  try {
    const code = countryCode.toUpperCase()
    return String.fromCodePoint(127397 + code.charCodeAt(0)) + String.fromCodePoint(127397 + code.charCodeAt(1))
  } catch {
    return '🌐'
  }
}

/** Check if session was active in last 5 minutes */
export function isSessionOnline(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false
  const diff = Date.now() - new Date(lastActiveAt).getTime()
  return diff < 5 * 60 * 1000 // 5 minutes
}

/** Check if session was active in last 30 minutes */
export function isSessionIdle(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false
  const diff = Date.now() - new Date(lastActiveAt).getTime()
  return diff >= 5 * 60 * 1000 && diff < 30 * 60 * 1000
}

const PLATFORM_COLORS: Record<string, string> = {
  Android: 'hsl(142, 71%, 45%)',
  iOS: 'hsl(217, 91%, 60%)',
  Web: 'hsl(280, 67%, 54%)',
  Windows: 'hsl(199, 89%, 48%)',
  macOS: 'hsl(25, 95%, 53%)',
  Linux: 'hsl(340, 75%, 54%)',
}

export default function RecentUsersPage() {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(15) // seconds, 0 = off
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null)
  const [copiedIp, setCopiedIp] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [timeframe, setTimeframe] = useState<TimeframeOption>('all')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilterOption>('all')
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeOption>('all')
  const [sortBy, setSortBy] = useState<SortOption>('active_desc')

  // Load Sessions
  const loadSessions = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_active_at', { ascending: false })
        .limit(200)

      if (error) {
        toast.error('Failed to load user sessions: ' + error.message)
      } else {
        setSessions((data || []) as UserSession[])
      }
    } catch (err: any) {
      toast.error('Error fetching sessions: ' + err.message)
    } finally {
      setLoading(false)
      if (isManual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Realtime Polling & Subscription
  useEffect(() => {
    if (autoRefreshInterval <= 0) return

    const interval = setInterval(() => {
      loadSessions(false)
    }, autoRefreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefreshInterval, loadSessions])

  // Subscribe to Supabase Realtime changes on user_sessions
  useEffect(() => {
    const channel = supabase
      .channel('user_sessions_live_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_sessions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSessions((prev) => [payload.new as UserSession, ...prev.filter(s => s.id !== payload.new.id)])
          } else if (payload.eventType === 'UPDATE') {
            setSessions((prev) =>
              prev.map((s) => (s.id === payload.new.id ? (payload.new as UserSession) : s))
            )
          } else if (payload.eventType === 'DELETE') {
            setSessions((prev) => prev.filter((s) => s.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // KPI Calculations
  const stats = useMemo(() => {
    const now = Date.now()
    const todayStr = new Date().toISOString().split('T')[0]

    let onlineNow = 0
    let activeToday = 0
    let registeredUsers = 0
    let guestUsers = 0

    const platformCounts: Record<string, number> = {}
    const countryCounts: Record<string, number> = {}

    sessions.forEach((s) => {
      const activeTime = new Date(s.last_active_at || s.created_at).getTime()
      const diffMinutes = (now - activeTime) / (1000 * 60)
      const dateKey = (s.last_active_at || s.created_at).split('T')[0]

      if (diffMinutes <= 5) {
        onlineNow++
      }
      if (dateKey === todayStr || diffMinutes <= 24 * 60) {
        activeToday++
      }

      if (s.user_id || s.user_email) {
        registeredUsers++
      } else {
        guestUsers++
      }

      const p = s.platform || 'Other'
      platformCounts[p] = (platformCounts[p] || 0) + 1

      const c = s.country || 'Unknown'
      countryCounts[c] = (countryCounts[c] || 0) + 1
    })

    const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]
    const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]

    return {
      total: sessions.length,
      onlineNow,
      activeToday,
      registeredUsers,
      guestUsers,
      topPlatform: topPlatform ? { name: topPlatform[0], count: topPlatform[1] } : null,
      topCountry: topCountry ? { name: topCountry[0], count: topCountry[1] } : null,
    }
  }, [sessions])

  // Chart data: Platform breakdown
  const platformChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    sessions.forEach((s) => {
      const p = s.platform || 'Other'
      counts[p] = (counts[p] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [sessions])

  // Chart data: Country breakdown (Top 5)
  const countryChartData = useMemo(() => {
    const counts: Record<string, { count: number; code: string }> = {}
    sessions.forEach((s) => {
      const c = s.country || 'Unknown'
      const code = s.country_code || ''
      if (!counts[c]) {
        counts[c] = { count: 0, code }
      }
      counts[c].count++
    })
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, item]) => ({
        country: `${getCountryFlag(item.code)} ${name}`,
        users: item.count,
      }))
  }, [sessions])

  // Filtering & Sorting Logic
  const filteredSessions = useMemo(() => {
    const now = Date.now()

    return sessions
      .filter((s) => {
        // 1. Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const nameMatch = (s.user_name || '').toLowerCase().includes(q)
          const emailMatch = (s.user_email || '').toLowerCase().includes(q)
          const ipMatch = (s.ip_address || '').toLowerCase().includes(q)
          const deviceMatch = (s.device_name || s.device_model || '').toLowerCase().includes(q)
          const countryMatch = (s.country || '').toLowerCase().includes(q)
          const cityMatch = (s.city || '').toLowerCase().includes(q)
          const screenMatch = (s.last_screen || '').toLowerCase().includes(q)

          if (!nameMatch && !emailMatch && !ipMatch && !deviceMatch && !countryMatch && !cityMatch && !screenMatch) {
            return false
          }
        }

        // 2. Timeframe Filter
        if (timeframe !== 'all') {
          const activeTime = new Date(s.last_active_at || s.created_at).getTime()
          const diffMinutes = (now - activeTime) / (1000 * 60)

          if (timeframe === 'now' && diffMinutes > 5) return false
          if (timeframe === '1h' && diffMinutes > 60) return false
          if (timeframe === 'today' && diffMinutes > 24 * 60) return false
          if (timeframe === '7d' && diffMinutes > 7 * 24 * 60) return false
          if (timeframe === '30d' && diffMinutes > 30 * 24 * 60) return false
        }

        // 3. Platform Filter
        if (platformFilter !== 'all') {
          if (s.platform !== platformFilter) return false
        }

        // 4. User Type Filter
        if (userTypeFilter !== 'all') {
          const isRegistered = !!(s.user_id || s.user_email)
          if (userTypeFilter === 'registered' && !isRegistered) return false
          if (userTypeFilter === 'guest' && isRegistered) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'active_desc') {
          return new Date(b.last_active_at || b.created_at).getTime() - new Date(a.last_active_at || a.created_at).getTime()
        }
        if (sortBy === 'active_asc') {
          return new Date(a.last_active_at || a.created_at).getTime() - new Date(b.last_active_at || b.created_at).getTime()
        }
        if (sortBy === 'country_asc') {
          return (a.country || '').localeCompare(b.country || '')
        }
        if (sortBy === 'device_asc') {
          return (a.device_name || '').localeCompare(b.device_name || '')
        }
        if (sortBy === 'name_asc') {
          return (a.user_name || a.user_email || 'Guest').localeCompare(b.user_name || b.user_email || 'Guest')
        }
        return 0
      })
  }, [sessions, searchQuery, timeframe, platformFilter, userTypeFilter, sortBy])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchQuery.trim()) count++
    if (timeframe !== 'all') count++
    if (platformFilter !== 'all') count++
    if (userTypeFilter !== 'all') count++
    return count
  }, [searchQuery, timeframe, platformFilter, userTypeFilter])

  const resetFilters = () => {
    setSearchQuery('')
    setTimeframe('all')
    setPlatformFilter('all')
    setUserTypeFilter('all')
    setSortBy('active_desc')
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIp(text)
    toast.success(`${label} copied to clipboard!`)
    setTimeout(() => setCopiedIp(null), 2000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">Recent App Users</h1>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 border-emerald-500/30 text-emerald-500 font-bold px-2.5 py-1 text-xs gap-1.5 flex items-center shadow-xs"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE TELEMETRY
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time presence, device specifications, IP addresses, and geolocation of MangaLoop readers
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto Refresh Interval */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/40 px-2.5 py-1 text-xs">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-muted-foreground font-medium">Auto-Sync:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
            >
              <option value={5}>Every 5s</option>
              <option value={15}>Every 15s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 1m</option>
              <option value={0}>Paused</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border/50 bg-secondary/40 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSessions(true)}
            disabled={refreshing}
            className="rounded-xl gap-2 cursor-pointer border-border/60 hover:bg-accent h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Online Now */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Now</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Zap className="h-5 w-5 animate-bounce" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-500">{stats.onlineNow}</span>
            <span className="text-xs text-muted-foreground font-medium">readers online (&lt; 5m)</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stats.onlineNow > 0 ? '🟢 Realtime active users browsing the app' : 'No users currently active'}
          </div>
        </div>

        {/* Active Today */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Today</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold">{stats.activeToday}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stats.registeredUsers} registered • {stats.guestUsers} guests
          </div>
        </div>

        {/* Top Platform */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Device Platform</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold truncate">
            {stats.topPlatform?.name || 'N/A'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stats.topPlatform ? `${stats.topPlatform.count} sessions recorded` : 'No device data'}
          </div>
        </div>

        {/* Top Country */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Location</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Globe className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold truncate">
            {stats.topCountry?.name || 'Worldwide'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stats.topCountry ? `${stats.topCountry.count} sessions from this region` : 'No location data'}
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Breakdown Pie */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Smartphone className="h-4 w-4 text-primary" />
              Device Platform Distribution
            </CardTitle>
            <CardDescription>Breakdown of client devices accessing the MangaLoop app</CardDescription>
          </CardHeader>
          <CardContent>
            {platformChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={platformChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {platformChartData.map((entry) => (
                      <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] || '#8B5CF6'} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No session telemetry yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Countries Bar Chart */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Globe className="h-4 w-4 text-emerald-500" />
              Top User Countries
            </CardTitle>
            <CardDescription>Geographic distribution of recent app users</CardDescription>
          </CardHeader>
          <CardContent>
            {countryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={countryChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="country"
                    type="category"
                    width={140}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="users" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                No location data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Control Bar */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by User, Email, IP Address, Device Name, Country, City, or Screen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 rounded-xl border border-border/60 bg-secondary/50 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="active_desc">⚡ Most Recently Active</option>
              <option value="active_asc">Oldest Activity First</option>
              <option value="country_asc">Country: A to Z</option>
              <option value="device_asc">Device Name: A to Z</option>
              <option value="name_asc">User Name: A to Z</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5 text-primary" />
            Filters:
          </div>

          {/* Timeframe Filter */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as TimeframeOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              timeframe !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">🕒 Time: All Recorded</option>
            <option value="now">🟢 Online Now (&lt; 5m)</option>
            <option value="1h">⚡ Last 1 Hour</option>
            <option value="today">📅 Active Today</option>
            <option value="7d">🗓️ Last 7 Days</option>
            <option value="30d">📆 Last 30 Days</option>
          </select>

          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as PlatformFilterOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              platformFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">📱 Platform: All</option>
            <option value="Android">🤖 Android</option>
            <option value="iOS">🍎 iOS</option>
            <option value="Web">🌐 Web</option>
            <option value="Windows">💻 Windows</option>
            <option value="macOS">🍏 macOS</option>
          </select>

          {/* User Type Filter */}
          <select
            value={userTypeFilter}
            onChange={(e) => setUserTypeFilter(e.target.value as UserTypeOption)}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium cursor-pointer border transition-colors ${
              userTypeFilter !== 'all'
                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                : 'bg-secondary/50 border-border/40 text-foreground'
            }`}
          >
            <option value="all">👤 User Type: All</option>
            <option value="registered">👑 Registered Users</option>
            <option value="guest">🕶️ Guest Readers</option>
          </select>

          {/* Reset Filters */}
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

        {/* Counter Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>
            Showing <strong className="text-foreground font-semibold">{filteredSessions.length}</strong> of{' '}
            <strong className="text-foreground font-semibold">{sessions.length}</strong> active user sessions
          </span>
          {activeFiltersCount > 0 && (
            <span className="text-primary font-medium">Filtered results applied</span>
          )}
        </div>
      </div>

      {/* Users Sessions Display: Table View */}
      {viewMode === 'table' ? (
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left min-w-[1150px]">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[240px]">
                    User &amp; Status
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[220px]">
                    Device &amp; OS
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[200px]">
                    IP Address &amp; Network
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[200px]">
                    Location
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground min-w-[150px]">
                    Active Screen
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right min-w-[150px]">
                    Last Seen
                  </th>
                  <th className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center min-w-[80px]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredSessions.map((session) => {
                  const online = isSessionOnline(session.last_active_at)
                  const idle = isSessionIdle(session.last_active_at)
                  const flag = getCountryFlag(session.country_code)

                  return (
                    <tr
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="transition-colors hover:bg-muted/20 cursor-pointer group"
                    >
                      {/* User & Status */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 shadow-xs">
                              {session.avatar_url ? (
                                <img
                                  src={session.avatar_url}
                                  alt="Avatar"
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                (session.user_name || session.user_email || 'G').charAt(0).toUpperCase()
                              )}
                            </div>
                            {/* Online Radar Dot */}
                            {online ? (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                            ) : idle ? (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-background" />
                            ) : (
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-muted-foreground/40 ring-2 ring-background" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-foreground" title={session.user_name || session.user_email || 'Guest Reader'}>
                                {session.user_name || (session.user_email ? session.user_email.split('@')[0] : 'Guest Reader')}
                              </span>
                              {session.user_id ? (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 font-semibold shrink-0">
                                  User
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground shrink-0">
                                  Guest
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground" title={session.user_email || `Session ID: ${session.session_id}`}>
                              {session.user_email || `Session: ${session.session_id.substring(0, 10)}...`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Device & OS */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            {session.platform === 'Android' ? (
                              <Smartphone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : session.platform === 'iOS' ? (
                              <Smartphone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <Laptop className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                            )}
                            <span className="font-semibold text-xs text-foreground" title={session.device_name || session.device_model || 'Unknown Device'}>
                              {session.device_name || session.device_model || 'Unknown Device'}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {session.os_version || session.platform || 'OS'} • v{session.app_version || '1.9.3'}
                          </span>
                        </div>
                      </td>

                      {/* IP Address & Network */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {session.ip_address || '127.0.0.1'}
                            </span>
                            {session.ip_address && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(session.ip_address!, 'IP Address')
                                }}
                                className="text-muted-foreground hover:text-foreground cursor-pointer opacity-70 hover:opacity-100 shrink-0"
                                title="Copy IP"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground" title={session.isp || 'Broadband Network'}>
                            {session.isp || 'Broadband Network'}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base leading-none">{flag}</span>
                            <span className="font-medium text-xs text-foreground" title={`${session.city ? `${session.city}, ` : ''}${session.country || 'Unknown'}`}>
                              {session.city ? `${session.city}, ` : ''}{session.country || 'Unknown'}
                            </span>
                          </div>
                          {session.region && (
                            <span className="text-[10px] text-muted-foreground" title={session.region}>
                              {session.region}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Active Screen */}
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="secondary"
                          className="bg-secondary/70 text-[11px] font-semibold"
                        >
                          <Layers className="h-3 w-3 mr-1 opacity-70" />
                          {session.last_screen || 'Home'}
                        </Badge>
                      </td>

                      {/* Last Seen */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            {online && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                            <span className={`text-xs font-semibold ${online ? 'text-emerald-500' : 'text-foreground'}`}>
                              {timeAgo(session.last_active_at || session.created_at)}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(session.last_active_at || session.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 cursor-pointer"
                          title="Inspect User Session"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSession(session)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}

                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      <Radio className="mx-auto mb-3 h-10 w-10 opacity-30 text-primary animate-pulse" />
                      <p className="font-bold text-foreground text-base">No active sessions matching your filters</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try changing the timeframe or clearing search keywords.
                      </p>
                      {activeFiltersCount > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={resetFilters}
                          className="mt-4 rounded-xl font-bold text-xs gap-2 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" /> Reset Filters
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => {
            const online = isSessionOnline(session.last_active_at)
            const idle = isSessionIdle(session.last_active_at)
            const flag = getCountryFlag(session.country_code)

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="group relative rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                {/* Card Top: User & Online status */}
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs">
                          {session.avatar_url ? (
                            <img
                              src={session.avatar_url}
                              alt="Avatar"
                              className="h-full w-full rounded-2xl object-cover"
                            />
                          ) : (
                            (session.user_name || session.user_email || 'G').charAt(0).toUpperCase()
                          )}
                        </div>
                        {online ? (
                          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                        ) : idle ? (
                          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-background" />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm truncate max-w-[150px]">
                            {session.user_name || (session.user_email ? session.user_email.split('@')[0] : 'Guest Reader')}
                          </p>
                          {session.user_id ? (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">User</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">Guest</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {session.user_email || 'Anonymous Guest'}
                        </p>
                      </div>
                    </div>

                    <span className="text-xl">{flag}</span>
                  </div>

                  {/* Device & Location Info */}
                  <div className="mt-4 space-y-2 rounded-xl bg-secondary/30 p-3 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-primary" /> Device:
                      </span>
                      <span className="font-semibold text-foreground truncate max-w-[140px]">
                        {session.device_name || session.device_model || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Wifi className="h-3.5 w-3.5 text-blue-500" /> IP Address:
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {session.ip_address || '127.0.0.1'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-rose-500" /> Location:
                      </span>
                      <span className="font-medium text-foreground truncate max-w-[140px]">
                        {session.city ? `${session.city}, ` : ''}{session.country || 'Global'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-amber-500" /> Screen:
                      </span>
                      <span className="font-medium text-foreground truncate max-w-[140px]">
                        {session.last_screen || 'Home'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {timeAgo(session.last_active_at || session.created_at)}
                  </span>
                  <span className="font-semibold text-primary group-hover:underline flex items-center gap-1">
                    Details <Eye className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detailed User Session Inspector Dialog Modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          {selectedSession && (
            <div>
              <DialogHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary text-base font-bold border border-primary/20">
                        {selectedSession.avatar_url ? (
                          <img
                            src={selectedSession.avatar_url}
                            alt="Avatar"
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        ) : (
                          (selectedSession.user_name || selectedSession.user_email || 'G').charAt(0).toUpperCase()
                        )}
                      </div>
                      {isSessionOnline(selectedSession.last_active_at) && (
                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black">
                        {selectedSession.user_name || (selectedSession.user_email ? selectedSession.user_email.split('@')[0] : 'Guest Reader')}
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        {selectedSession.user_email || 'Guest Anonymous Session'} • ID: {selectedSession.id.substring(0, 8)}...
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge
                      variant={isSessionOnline(selectedSession.last_active_at) ? 'success' : 'secondary'}
                      className="font-bold text-xs"
                    >
                      {isSessionOnline(selectedSession.last_active_at) ? '🟢 Online Now' : `Active ${timeAgo(selectedSession.last_active_at || selectedSession.created_at)}`}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              {/* Inspector Content */}
              <div className="py-4 space-y-5">
                {/* Hardware & Device Specifications */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-primary" /> Device Specifications
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Device Name</span>
                      <p className="font-semibold text-xs mt-0.5">{selectedSession.device_name || 'Generic Device'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Model</span>
                      <p className="font-semibold text-xs mt-0.5">{selectedSession.device_model || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Platform / OS</span>
                      <p className="font-semibold text-xs mt-0.5">{selectedSession.os_version || selectedSession.platform || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">App Version</span>
                      <p className="font-semibold text-xs mt-0.5">v{selectedSession.app_version || '1.9.3'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Browser / Engine</span>
                      <p className="font-semibold text-xs mt-0.5">{selectedSession.browser || 'Webview'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Screen Resolution</span>
                      <p className="font-semibold text-xs mt-0.5">{selectedSession.screen_resolution || 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                {/* Geolocation & IP Network */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-emerald-500" /> Geolocation &amp; Network
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-secondary/30 p-3 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">IP Address</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="font-mono font-bold text-xs">{selectedSession.ip_address || '127.0.0.1'}</p>
                        {selectedSession.ip_address && (
                          <button
                            onClick={() => copyToClipboard(selectedSession.ip_address!, 'IP Address')}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Copy IP"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Country</span>
                      <p className="font-semibold text-xs mt-0.5 flex items-center gap-1.5">
                        <span>{getCountryFlag(selectedSession.country_code)}</span>
                        {selectedSession.country || 'Global'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">City / Region</span>
                      <p className="font-semibold text-xs mt-0.5 truncate">
                        {selectedSession.city ? `${selectedSession.city}, ` : ''}{selectedSession.region || 'Unknown'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">ISP / Provider</span>
                      <p className="font-semibold text-xs mt-0.5 truncate">{selectedSession.isp || 'Broadband Provider'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Timezone</span>
                      <p className="font-semibold text-xs mt-0.5">{selectedSession.timezone || 'UTC'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Coordinates</span>
                      {selectedSession.latitude && selectedSession.longitude ? (
                        <a
                          href={`https://maps.google.com/?q=${selectedSession.latitude},${selectedSession.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-xs mt-0.5 text-primary hover:underline flex items-center gap-1"
                        >
                          {selectedSession.latitude.toFixed(2)}, {selectedSession.longitude.toFixed(2)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="font-semibold text-xs mt-0.5 text-muted-foreground">Not available</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session & Activity Details */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-purple-500" /> Session Activity
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Current / Last Screen</span>
                      <p className="font-semibold text-xs mt-0.5 text-foreground">{selectedSession.last_screen || 'Home'}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Session ID</span>
                      <p className="font-mono text-xs mt-0.5 truncate text-muted-foreground">{selectedSession.session_id}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">First Seen</span>
                      <p className="font-semibold text-xs mt-0.5">{formatDateTime(selectedSession.first_seen || selectedSession.created_at)}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/30 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Last Heartbeat</span>
                      <p className="font-semibold text-xs mt-0.5">{formatDateTime(selectedSession.last_active_at || selectedSession.created_at)} ({timeAgo(selectedSession.last_active_at || selectedSession.created_at)})</p>
                    </div>
                  </div>
                </div>

                {/* User Agent String */}
                {selectedSession.user_agent && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User Agent String</span>
                      <button
                        onClick={() => copyToClipboard(selectedSession.user_agent!, 'User Agent')}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <pre className="max-h-20 overflow-auto rounded-xl bg-secondary/40 p-2.5 text-[10px] font-mono text-muted-foreground scrollbar-thin">
                      {selectedSession.user_agent}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
