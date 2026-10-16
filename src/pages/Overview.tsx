import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users,
  BookOpen,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Activity,
  Radio,
  Smartphone,
  Globe,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/utils'
import { getCountryFlag, isSessionOnline, UserSession } from './RecentUsers'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

interface AdminStats {
  total_users: number
  total_manga: number
  total_chapters: number
  popular_manga: string
}

const STATUS_COLORS: Record<string, string> = {
  Reading: 'hsl(221, 83%, 53%)',
  Completed: 'hsl(142, 71%, 45%)',
  'Plan to Read': 'hsl(25, 95%, 53%)',
  'Caught Up': 'hsl(280, 67%, 54%)',
  Dropped: 'hsl(0, 84%, 60%)',
}

export default function OverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([])
  const [signupData, setSignupData] = useState<{ date: string; users: number }[]>([])
  const [topManga, setTopManga] = useState<{ title: string; count: number }[]>([])
  const [recentSessions, setRecentSessions] = useState<UserSession[]>([])
  const [onlineCount, setOnlineCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Admin stats via RPC
      const { data: statsData } = await supabase.rpc('get_admin_stats')
      if (statsData) setStats(statsData)

      // 2. Manga status distribution
      const { data: libraryData } = await supabase
        .from('manga_library')
        .select('status')
      if (libraryData) {
        const counts: Record<string, number> = {}
        libraryData.forEach((m: { status: string }) => {
          counts[m.status] = (counts[m.status] || 0) + 1
        })
        setStatusData(Object.entries(counts).map(([name, value]) => ({ name, value })))
      }

      // 3. Top manga by count
      const { data: topData } = await supabase
        .from('manga_library')
        .select('title')
      if (topData) {
        const titleCounts: Record<string, number> = {}
        topData.forEach((m: { title: string }) => {
          titleCounts[m.title] = (titleCounts[m.title] || 0) + 1
        })
        const sorted = Object.entries(titleCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([title, count]) => ({ title: title.length > 25 ? title.substring(0, 25) + '…' : title, count }))
        setTopManga(sorted)
      }

      // 4. Signup data (last 14 days from profiles)
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', fourteenDaysAgo.toISOString())
        .order('created_at', { ascending: true })
      if (profilesData) {
        const dayCounts: Record<string, number> = {}
        for (let i = 13; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const key = d.toISOString().split('T')[0]
          dayCounts[key] = 0
        }
        profilesData.forEach((p: { created_at: string }) => {
          const day = p.created_at.split('T')[0]
          if (dayCounts[day] !== undefined) dayCounts[day]++
        })
        setSignupData(Object.entries(dayCounts).map(([date, users]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          users,
        })))
      }

      // 5. Recent active user sessions
      const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_active_at', { ascending: false })
        .limit(6)
      if (sessionData) {
        setRecentSessions(sessionData as UserSession[])
        const now = Date.now()
        const online = sessionData.filter((s: any) => {
          const diff = now - new Date(s.last_active_at || s.created_at).getTime()
          return diff < 5 * 60 * 1000
        }).length
        setOnlineCount(online)
      }
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Your MangaLoop platform at a glance</p>
        </div>
        <button
          onClick={loadData}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-all hover:bg-accent hover:text-foreground cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">Live Readers</span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-emerald-500">{onlineCount}</span>
            <span className="text-xs text-muted-foreground ml-1.5 font-medium">online now</span>
          </div>
          <Link
            to="/recent-users"
            className="text-[11px] font-bold text-emerald-500 hover:underline flex items-center gap-1 mt-1"
          >
            Live Monitor <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <StatCard
          label="Total Users"
          value={stats?.total_users?.toLocaleString() ?? '0'}
          icon={Users}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          label="Manga Tracked"
          value={stats?.total_manga?.toLocaleString() ?? '0'}
          icon={BookOpen}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          label="Chapters Read"
          value={stats?.total_chapters?.toLocaleString() ?? '0'}
          icon={Sparkles}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
        />
        <StatCard
          label="Most Popular"
          value={stats?.popular_manga ?? 'N/A'}
          icon={TrendingUp}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Signups Area Chart */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Activity className="h-4 w-4 text-primary" />
              User Signups (Last 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={signupData}>
                <defs>
                  <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2}
                  fill="url(#signupGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <BookOpen className="h-4 w-4 text-amber-500" />
              Manga Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#64748B'} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
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
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No manga data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Live Activity Stream */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
              Live Readers &amp; Recent App Activity
            </CardTitle>
            <CardDescription>Recently active users, their devices, IP addresses, and locations</CardDescription>
          </div>
          <Link
            to="/recent-users"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            View Live Dashboard ({recentSessions.length}) <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {recentSessions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentSessions.map((session) => {
                const online = isSessionOnline(session.last_active_at)
                const flag = getCountryFlag(session.country_code)

                return (
                  <Link
                    key={session.id}
                    to="/recent-users"
                    className="flex items-start gap-3 rounded-xl border border-border/40 bg-secondary/30 p-3 transition-all hover:bg-secondary/60 hover:border-border cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                        {session.avatar_url ? (
                          <img
                            src={session.avatar_url}
                            alt="Avatar"
                            className="h-full w-full rounded-xl object-cover"
                          />
                        ) : (
                          (session.user_name || session.user_email || 'G').charAt(0).toUpperCase()
                        )}
                      </div>
                      {online && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-xs truncate max-w-[120px]">
                          {session.user_name || (session.user_email ? session.user_email.split('@')[0] : 'Guest Reader')}
                        </p>
                        <span className="text-sm">{flag}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        📱 {session.device_name || session.device_model || 'Device'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                        <span className="font-mono">{session.ip_address || '127.0.0.1'}</span>
                        <span>{timeAgo(session.last_active_at || session.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
              No recent app activity recorded yet. Run the app to populate telemetry!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Manga Bar Chart */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Top Manga by Library Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topManga.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topManga} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="title"
                  type="category"
                  width={180}
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
                <Bar dataKey="count" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No manga data available
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
