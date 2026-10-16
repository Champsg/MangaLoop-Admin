import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatDateTime, timeAgo } from '@/lib/utils'

interface AppError {
  id: string
  context: string
  error_message: string
  error_stack: string | null
  page_url: string | null
  user_id: string | null
  user_email: string | null
  device_info: string | null
  extra_data: Record<string, unknown> | null
  created_at: string
}

export default function ErrorLogsPage() {
  const [errors, setErrors] = useState<AppError[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadErrors = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('app_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) toast.error('Failed to load errors')
    else setErrors((data || []) as AppError[])
    setLoading(false)
  }

  useEffect(() => { loadErrors() }, [])

  const filtered = errors.filter(e =>
    e.error_message.toLowerCase().includes(search.toLowerCase()) ||
    e.context.toLowerCase().includes(search.toLowerCase()) ||
    (e.user_email || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 rounded-xl" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Error Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">{errors.length} errors captured</p>
        </div>
        <button onClick={loadErrors} className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search errors by message, context, or user..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-secondary/50 border-none"
        />
      </div>

      {/* Error list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/10 py-16">
          <AlertTriangle className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'No matching errors' : 'No errors recorded'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(err => {
            const expanded = expandedId === err.id
            return (
              <div key={err.id} className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm transition-colors hover:border-border">
                <button
                  className="flex w-full items-start gap-3 p-4 text-left cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : err.id)}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-[10px]">{err.context}</Badge>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(err.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium truncate">{err.error_message}</p>
                    {err.user_email && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{err.user_email}</p>
                    )}
                  </div>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                </button>

                {expanded && (
                  <div className="border-t border-border/30 bg-muted/10 p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timestamp</label>
                        <p className="text-sm">{formatDateTime(err.created_at)}</p>
                      </div>
                      {err.page_url && (
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Page URL</label>
                          <p className="text-sm flex items-center gap-1 truncate">
                            {err.page_url}
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </p>
                        </div>
                      )}
                      {err.device_info && (
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Device</label>
                          <p className="text-xs text-muted-foreground">{err.device_info}</p>
                        </div>
                      )}
                    </div>
                    {err.error_stack && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stack Trace</label>
                        <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-background p-3 text-[11px] text-muted-foreground font-mono scrollbar-thin">
                          {err.error_stack}
                        </pre>
                      </div>
                    )}
                    {err.extra_data && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Extra Data</label>
                        <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-background p-3 text-[11px] text-muted-foreground font-mono scrollbar-thin">
                          {JSON.stringify(err.extra_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
