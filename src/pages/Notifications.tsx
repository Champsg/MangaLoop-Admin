/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Send,
  Users,
  User,
  Megaphone,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Search,
  Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'

interface SentNotification {
  id: string
  user_id: string | null
  title: string
  message: string
  type: 'announcement' | 'info' | 'alert' | 'request_update' | 'system'
  action_url: string | null
  created_at: string
  profiles?: { email: string; full_name?: string } | null
}

interface UserProfile {
  id: string
  email: string
  full_name?: string
}

export default function NotificationsPage() {
  const [sentList, setSentList] = useState<SentNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)

  // Form state
  const [targetType, setTargetType] = useState<'broadcast' | 'user'>('broadcast')
  const [targetUserId, setTargetUserId] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<UserProfile[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [searchingUsers, setSearchingUsers] = useState(false)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'announcement' | 'info' | 'alert' | 'request_update' | 'system'>('announcement')
  const [actionUrl, setActionUrl] = useState('')

  const loadSentNotifications = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((n: any) => n.user_id).filter(Boolean))]
        let profileMap: Record<string, { email: string; full_name?: string }> = {}

        if (userIds.length > 0) {
          try {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .in('id', userIds)

            if (profilesData) {
              profileMap = profilesData.reduce((acc: any, p: any) => {
                acc[p.id] = { email: p.email, full_name: p.full_name }
                return acc
              }, {})
            }
          } catch (e) {
            console.error('Failed to load profiles for notifications:', e)
          }
        }

        const formatted = data.map((n: any) => ({
          ...n,
          profiles: n.user_id ? profileMap[n.user_id] || null : null,
        }))

        setSentList(formatted)
      } else {
        setSentList([])
      }
    } catch (err: any) {
      console.error('Failed to load notifications:', err)
      toast.error(err?.message || 'Failed to load sent notifications')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSentNotifications()
  }, [])

  // User search for targeted notifications
  useEffect(() => {
    if (!userSearchQuery.trim() || targetType !== 'user') {
      setUserSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .or(`email.ilike.%${userSearchQuery}%,full_name.ilike.%${userSearchQuery}%`)
          .limit(5)

        if (data) setUserSearchResults(data as UserProfile[])
      } catch {
        setUserSearchResults([])
      } finally {
        setSearchingUsers(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [userSearchQuery, targetType])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return toast.error('Please enter a notification title')
    if (!message.trim()) return toast.error('Please enter a notification message')
    if (targetType === 'user' && !targetUserId && !selectedUser) {
      return toast.error('Please select a recipient user')
    }

    setSending(true)
    try {
      const finalUserId = targetType === 'user' ? (selectedUser ? selectedUser.id : targetUserId.trim()) : null

      const { data, error } = await supabase
        .from('user_notifications')
        .insert([
          {
            user_id: finalUserId,
            title: title.trim(),
            message: message.trim(),
            type,
            action_url: actionUrl.trim() || null,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (error) throw error

      toast.success(
        targetType === 'broadcast'
          ? 'Broadcast notification sent to ALL users!'
          : `Notification sent to ${selectedUser?.email || 'selected user'}!`
      )

      if (data) {
        setSentList(prev => [data as SentNotification, ...prev])
      }

      // Reset form
      setTitle('')
      setMessage('')
      setActionUrl('')
      setSelectedUser(null)
      setTargetUserId('')
      setUserSearchQuery('')
    } catch (err: any) {
      console.error('Failed to send notification:', err)
      toast.error(err?.message || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification? Users will no longer see it.')) return
    try {
      const { error } = await supabase.from('user_notifications').delete().eq('id', id)
      if (error) throw error
      setSentList(prev => prev.filter(n => n.id !== id))
      toast.success('Notification deleted')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete')
    }
  }

  const setTemplate = (tpl: { title: string; message: string; type: any; actionUrl?: string }) => {
    setTitle(tpl.title)
    setMessage(tpl.message)
    setType(tpl.type)
    if (tpl.actionUrl) setActionUrl(tpl.actionUrl)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Bell className="h-7 w-7 text-primary" />
            Push &amp; In-App Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Broadcast announcements to all users or send direct targeted messages
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadSentNotifications(true)}
          disabled={refreshing}
          className="rounded-xl gap-2 h-9 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Compose Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-3xl border-border/50 bg-card shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" /> Compose Notification
                </CardTitle>
                <Badge variant="outline" className="rounded-lg text-[10px] uppercase font-bold">
                  {targetType === 'broadcast' ? 'Global Broadcast' : 'Direct Message'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-4">
                {/* Target Switcher */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Target Audience</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={targetType === 'broadcast' ? 'default' : 'outline'}
                      onClick={() => {
                        setTargetType('broadcast')
                        setSelectedUser(null)
                      }}
                      className="rounded-xl h-11 text-xs font-bold gap-2"
                    >
                      <Users className="h-4 w-4" /> Broadcast to All Users
                    </Button>
                    <Button
                      type="button"
                      variant={targetType === 'user' ? 'default' : 'outline'}
                      onClick={() => setTargetType('user')}
                      className="rounded-xl h-11 text-xs font-bold gap-2"
                    >
                      <User className="h-4 w-4" /> Specific User
                    </Button>
                  </div>
                </div>

                {/* Specific User Selector */}
                {targetType === 'user' && (
                  <div className="space-y-2 p-3.5 rounded-2xl bg-secondary/30 border border-border/40 animate-in fade-in duration-200">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Select Recipient</span>
                      {selectedUser && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(null)
                            setUserSearchQuery('')
                          }}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Change user
                        </button>
                      )}
                    </label>

                    {selectedUser ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>{selectedUser.email}</span>
                          {selectedUser.full_name && (
                            <span className="text-muted-foreground">({selectedUser.full_name})</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search user by email or name..."
                            value={userSearchQuery}
                            onChange={e => setUserSearchQuery(e.target.value)}
                            className="pl-9 rounded-xl text-xs bg-card"
                          />
                        </div>
                        {searchingUsers && <p className="text-[11px] text-muted-foreground">Searching users...</p>}
                        {userSearchResults.length > 0 && (
                          <div className="rounded-xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
                            {userSearchResults.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => setSelectedUser(u)}
                                className="w-full text-left p-2.5 text-xs hover:bg-accent flex items-center justify-between transition-colors"
                              >
                                <span className="font-semibold text-foreground">{u.email}</span>
                                {u.full_name && <span className="text-muted-foreground">{u.full_name}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Templates */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Templates</label>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setTemplate({
                          title: '🎉 MangaLoop 2.0 Is Live!',
                          message: 'Enjoy faster searches with MangaUpdates scanlation tracking, unified library syncing, and new themes!',
                          type: 'announcement',
                          actionUrl: '/discover',
                        })
                      }
                      className="h-7 text-[10px] font-semibold rounded-lg"
                    >
                      🎉 Update Announcement
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setTemplate({
                          title: '⚡ Scheduled Maintenance',
                          message: 'MangaLoop will undergo scheduled server optimization tonight at 12:00 AM UTC for 15 minutes.',
                          type: 'alert',
                        })
                      }
                      className="h-7 text-[10px] font-semibold rounded-lg"
                    >
                      ⚡ Maintenance
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setTemplate({
                          title: '✨ New Chapters Available',
                          message: 'Check your library for newly translated chapters across your favorite series!',
                          type: 'info',
                          actionUrl: '/',
                        })
                      }
                      className="h-7 text-[10px] font-semibold rounded-lg"
                    >
                      ✨ New Chapters
                    </Button>
                  </div>
                </div>

                {/* Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Notification Category</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: 'announcement', label: 'Announcement', icon: Megaphone },
                      { id: 'info', label: 'Info', icon: Info },
                      { id: 'alert', label: 'Alert', icon: AlertTriangle },
                      { id: 'request_update', label: 'Request', icon: CheckCircle2 },
                      { id: 'system', label: 'System', icon: Bell },
                    ].map(t => (
                      <Button
                        key={t.id}
                        type="button"
                        variant={type === t.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setType(t.id as any)}
                        className="rounded-xl text-[11px] h-9 gap-1 font-semibold"
                      >
                        <t.icon className="h-3 w-3" /> {t.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Notification Title</label>
                  <Input
                    placeholder="e.g. MangaLoop New Feature Release"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="rounded-xl font-bold"
                    required
                  />
                </div>

                {/* Body */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Message Body</label>
                  <textarea
                    placeholder="Type the message you want users to receive..."
                    value={message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl bg-secondary/50 border border-border/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                    required
                  />
                </div>

                {/* Action URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Action URL (Optional)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">e.g. /search, /manga/123, or https://...</span>
                  </label>
                  <Input
                    placeholder="e.g. /search or https://ko-fi.com/mangaloop"
                    value={actionUrl}
                    onChange={e => setActionUrl(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={sending || !title.trim() || !message.trim()}
                  className="w-full rounded-2xl h-12 font-extrabold gap-2 shadow-lg shadow-primary/25"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Dispatching Notification...' : targetType === 'broadcast' ? 'Broadcast to All Users' : 'Send Direct Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sent History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-3xl border-border/50 bg-card shadow-lg">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Sent Notifications Log
              </CardTitle>
              <Badge variant="secondary" className="rounded-lg text-[10px] font-bold">
                {sentList.length} Sent
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {sentList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Bell className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-xs">No notifications sent yet</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {sentList.map(n => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-3.5 rounded-2xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-all space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-1">{n.title}</h4>
                          <Badge
                            className={`text-[9px] uppercase font-bold px-1.5 py-0 rounded border ${
                              !n.user_id
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {!n.user_id ? 'All' : 'Direct'}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground/70">
                          <span>{formatDateTime(n.created_at)}</span>
                          <button
                            onClick={() => handleDelete(n.id)}
                            className="p-1 hover:text-rose-500 transition-colors"
                            title="Delete notification"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
