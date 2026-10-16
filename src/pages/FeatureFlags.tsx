/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Flag, RefreshCw, Flame, Bell, Sparkles, Database } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface FeatureFlag {
  id: number
  feature_name: string
  enabled: boolean
  config?: Record<string, any>
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)

  const loadFlags = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('feature_flags').select('*').order('feature_name')
    if (error) {
      toast.error('Failed to load feature flags')
    } else {
      setFlags(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { 
    loadFlags() 

    // Subscribe to Realtime changes
    const channel = supabase
      .channel('admin:feature_flags_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_flags' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setFlags(prev => prev.map(f => f.feature_name === payload.new.feature_name ? { ...f, ...payload.new } : f))
          } else {
            loadFlags()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadFlags])

  const toggleFlag = async (name: string, current: boolean) => {
    const nextState = !current
    setFlags(prev => prev.map(f => f.feature_name === name ? { ...f, enabled: nextState } : f))

    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled: nextState, updated_at: new Date().toISOString() })
      .eq('feature_name', name)

    if (error) {
      toast.error(`Failed to update ${name}`)
      loadFlags()
    } else {
      toast.success(`${name} ${nextState ? 'enabled' : 'disabled'}`)
    }
  }

  const updateFlagConfig = async (name: string, newConfig: Record<string, any>) => {
    const currentFlag = flags.find(f => f.feature_name === name)
    const mergedConfig = { ...(currentFlag?.config || {}), ...newConfig }

    setFlags(prev => prev.map(f => f.feature_name === name ? { ...f, config: mergedConfig } : f))

    const { error } = await supabase
      .from('feature_flags')
      .update({ config: mergedConfig, updated_at: new Date().toISOString() })
      .eq('feature_name', name)

    if (error) {
      toast.error('Failed to update config in database')
      loadFlags()
    } else {
      if (newConfig.default_api) {
        const apiName = newConfig.default_api === 'anilist' 
          ? 'AniList (Trending)' 
          : newConfig.default_api === 'mangabaka'
            ? 'MangaBaka (Trending)'
            : newConfig.default_api === 'mal' 
              ? 'MyAnimeList (Top MAL)' 
              : 'MangaDex'
        toast.success(`Trending API switched to ${apiName}`)
      } else if (newConfig.provider) {
        const provName = newConfig.provider === 'mangabaka'
          ? 'MangaBaka (Similar Series & Readers Also Like)'
          : 'AniList (Community Recommendations)'
        toast.success(`Recommendations provider switched to ${provName}`)
      } else {
        toast.success('Configuration updated')
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Feature Flags</h1>
          <p className="text-sm text-muted-foreground mt-1">Toggle app features &amp; configure APIs in real-time</p>
        </div>
        <button
          onClick={loadFlags}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {flags.map(flag => {
          const isTrending = flag.feature_name === 'trending'
          const isNotifications = flag.feature_name === 'notifications'
          const isRecs = flag.feature_name === 'recommendations'

          const IconComponent = isTrending ? Flame : isNotifications ? Bell : isRecs ? Sparkles : Flag
          const activeTrendingApi = flag.config?.default_api || 'anilist'
          const activeRecsProvider = flag.config?.provider || 'mangabaka'

          return (
            <div
              key={flag.id}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border flex flex-col justify-between"
            >
              {/* Background decoration */}
              <div className={`absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity ${flag.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                <IconComponent className="h-24 w-24" />
              </div>

              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                    flag.enabled
                      ? 'bg-primary/10 text-primary shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={() => toggleFlag(flag.feature_name, flag.enabled)}
                  />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold capitalize">{flag.feature_name.replace(/_/g, ' ')}</h3>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    {flag.enabled ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        LIVE
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                        OFFLINE
                      </>
                    )}
                  </p>
                </div>

                {/* Recommendations Provider Switcher */}
                {isRecs && (
                  <div className="pt-4 border-t border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Select Provider:</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {activeRecsProvider === 'anilist' ? 'AniList' : 'MangaBaka'}
                      </span>
                    </div>

                    {/* Segmented Pill Switch */}
                    <div className="p-1 bg-black/60 dark:bg-black/60 rounded-full border border-white/10 flex items-center gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => updateFlagConfig('recommendations', { provider: 'mangabaka' })}
                        className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 text-center select-none cursor-pointer ${
                          activeRecsProvider === 'mangabaka'
                            ? 'bg-transparent text-emerald-400 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        MANGABAKA
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFlagConfig('recommendations', { provider: 'anilist' })}
                        className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 text-center select-none cursor-pointer ${
                          activeRecsProvider === 'anilist'
                            ? 'bg-transparent text-emerald-400 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ANILIST
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 pt-1">
                      <Database className="h-3 w-3" />
                      <span>Updates similar series &amp; recommendations live</span>
                    </div>
                  </div>
                )}

                {/* Trending API Switcher */}
                {isTrending && (
                  <div className="pt-4 border-t border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Select Active API:</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {activeTrendingApi === 'mangabaka'
                          ? 'MangaBaka'
                          : activeTrendingApi === 'mal'
                            ? 'MyAnimeList'
                            : activeTrendingApi === 'mangadex'
                              ? 'MangaDex'
                              : 'AniList'}
                      </span>
                    </div>

                    {/* Segmented Pill Switch */}
                    <div className="p-1 bg-black/60 dark:bg-black/60 rounded-full border border-white/10 flex items-center gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => updateFlagConfig('trending', { default_api: 'anilist' })}
                        className={`flex-1 py-1.5 px-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 text-center select-none cursor-pointer ${
                          activeTrendingApi === 'anilist'
                            ? 'bg-transparent text-emerald-400 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        TRENDING
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFlagConfig('trending', { default_api: 'mangabaka' })}
                        className={`flex-1 py-1.5 px-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 text-center select-none cursor-pointer ${
                          activeTrendingApi === 'mangabaka'
                            ? 'bg-transparent text-emerald-400 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        MANGABAKA
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFlagConfig('trending', { default_api: 'mal' })}
                        className={`flex-1 py-1.5 px-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 text-center select-none cursor-pointer ${
                          activeTrendingApi === 'mal'
                            ? 'bg-transparent text-emerald-400 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        TOP MAL
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFlagConfig('trending', { default_api: 'mangadex' })}
                        className={`flex-1 py-1.5 px-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all duration-200 text-center select-none cursor-pointer ${
                          activeTrendingApi === 'mangadex'
                            ? 'bg-transparent text-emerald-400 border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        MANGADEX
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 pt-1">
                      <Database className="h-3 w-3" />
                      <span>Updates front-end feed in real-time</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {flags.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/10 py-16">
            <Flag className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No feature flags found</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
