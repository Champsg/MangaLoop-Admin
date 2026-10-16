import { motion } from 'framer-motion'
import { Database, Shield, Moon, Sun, Monitor, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

export default function SettingsPage() {
  const { user } = useAuth()
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) {
      setTheme(stored)
    } else {
      setTheme('dark')
    }
  }, [])

  const applyTheme = (t: Theme) => {
    setTheme(t)
    localStorage.setItem('theme', t)
    const root = document.documentElement
    if (t === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    } else {
      root.classList.toggle('dark', t === 'dark')
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'Not configured'
  const projectRef = supabaseUrl.includes('supabase.co')
    ? supabaseUrl.replace('https://', '').replace('.supabase.co', '')
    : 'N/A'

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Dashboard configuration and info</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Theme */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Moon className="h-4 w-4 text-primary" /> Appearance
            </CardTitle>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'light' as Theme, label: 'Light', icon: Sun },
                { value: 'dark' as Theme, label: 'Dark', icon: Moon },
                { value: 'system' as Theme, label: 'System', icon: Monitor },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => applyTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl p-4 text-sm font-medium transition-all cursor-pointer ${
                    theme === opt.value
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <opt.icon className="h-5 w-5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Admin Info */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Shield className="h-4 w-4 text-amber-500" /> Admin Account
            </CardTitle>
            <CardDescription>Currently signed-in admin info</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user?.email || 'N/A'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">User ID</span>
              <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{user?.id || 'N/A'}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="warning" className="font-bold">Admin</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Supabase Project */}
        <Card className="rounded-2xl border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Database className="h-4 w-4 text-emerald-500" /> Supabase Project
            </CardTitle>
            <CardDescription>Connected backend configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-muted/30 p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project URL</p>
                <p className="text-sm font-mono truncate">{supabaseUrl}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Reference</p>
                <p className="text-sm font-mono">{projectRef}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-500">Connected</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
                <a href={`https://supabase.com/dashboard/project/${projectRef}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Supabase Dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>MangaLoop Admin Dashboard v1.0.0</p>
      </div>
    </motion.div>
  )
}
