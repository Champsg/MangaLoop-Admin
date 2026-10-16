/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Search,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Globe,
  User,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'

export interface MangaRequest {
  id: string
  user_id: string | null
  user_email: string | null
  title: string
  alt_title: string | null
  source_url: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export default function MangaRequestsPage() {
  const [requests, setRequests] = useState<MangaRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Dialog state for reject / notes
  const [activeRequest, setActiveRequest] = useState<MangaRequest | null>(null)
  const [adminNoteInput, setAdminNoteInput] = useState('')
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [processing, setProcessing] = useState(false)

  const loadRequests = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)

    try {
      const { data, error } = await supabase
        .from('manga_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setRequests(data as MangaRequest[])
    } catch (err: any) {
      console.error('Failed to load manga requests:', err)
      toast.error(err?.message || 'Failed to load requests')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadRequests()

    // Real-time subscription
    const channel = supabase
      .channel('manga_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manga_requests' }, () => {
        loadRequests(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleUpdateStatus = async (req: MangaRequest, newStatus: 'pending' | 'approved' | 'rejected', notes?: string) => {
    setProcessing(true)
    try {
      const { data, error } = await supabase
        .from('manga_requests')
        .update({
          status: newStatus,
          admin_notes: notes !== undefined ? notes : req.admin_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.id)
        .select()
        .single()

      if (error) throw error

      // Auto-dispatch in-app notification to requester if user_id is linked
      if (req.user_id && (newStatus === 'approved' || newStatus === 'rejected')) {
        try {
          const isApproved = newStatus === 'approved';
          await supabase.from('user_notifications').insert([
            {
              user_id: req.user_id,
              title: isApproved ? `Request Approved: ${req.title}` : `Request Rejected: ${req.title}`,
              message: isApproved
                ? `Good news! Your request for "${req.title}" has been approved.${notes ? ` Note: ${notes}` : ''}`
                : `Your request for "${req.title}" was not approved.${notes ? ` Reason: ${notes}` : ''}`,
              type: isApproved ? 'request_update' : 'alert',
              action_url: isApproved ? `/search?q=${encodeURIComponent(req.title)}` : null,
              created_at: new Date().toISOString(),
            },
          ])
        } catch (notifErr) {
          console.warn('Failed to send auto notification to user:', notifErr)
        }
      }

      setRequests(prev => prev.map(r => (r.id === req.id ? (data as MangaRequest) : r)))
      toast.success(`Request marked as ${newStatus}`)
      setActiveRequest(null)
      setActionType(null)
      setAdminNoteInput('')
    } catch (err: any) {
      console.error('Status update failed:', err)
      toast.error(err?.message || 'Failed to update status')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return
    try {
      const { error } = await supabase.from('manga_requests').delete().eq('id', id)
      if (error) throw error
      setRequests(prev => prev.filter(r => r.id !== id))
      toast.success('Request deleted')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete request')
    }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.alt_title && r.alt_title.toLowerCase().includes(q)) ||
        (r.user_email && r.user_email.toLowerCase().includes(q)) ||
        (r.source_url && r.source_url.toLowerCase().includes(q))

      return matchesStatus && matchesSearch
    })
  }, [requests, statusFilter, search])

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    }
  }, [requests])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
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
            <Inbox className="h-7 w-7 text-primary" />
            Manga Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Review user-submitted requests for unlisted webtoons and scanlations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRequests(true)}
            disabled={refreshing}
            className="rounded-xl gap-2 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          onClick={() => setStatusFilter('all')}
          className={`rounded-2xl cursor-pointer transition-all border-border/50 ${
            statusFilter === 'all' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-accent/40'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-2xl font-black mt-0.5">{counts.all}</p>
            </div>
            <Inbox className="h-7 w-7 text-muted-foreground/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter('pending')}
          className={`rounded-2xl cursor-pointer transition-all border-border/50 ${
            statusFilter === 'pending' ? 'ring-2 ring-amber-500 bg-amber-500/5' : 'hover:bg-accent/40'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-black mt-0.5 text-amber-500">{counts.pending}</p>
            </div>
            <Clock className="h-7 w-7 text-amber-500/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter('approved')}
          className={`rounded-2xl cursor-pointer transition-all border-border/50 ${
            statusFilter === 'approved' ? 'ring-2 ring-emerald-500 bg-emerald-500/5' : 'hover:bg-accent/40'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Approved</p>
              <p className="text-2xl font-black mt-0.5 text-emerald-500">{counts.approved}</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-500/40" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter('rejected')}
          className={`rounded-2xl cursor-pointer transition-all border-border/50 ${
            statusFilter === 'rejected' ? 'ring-2 ring-rose-500 bg-rose-500/5' : 'hover:bg-accent/40'
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Rejected</p>
              <p className="text-2xl font-black mt-0.5 text-rose-500">{counts.rejected}</p>
            </div>
            <XCircle className="h-7 w-7 text-rose-500/40" />
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, alternative name, user email, or source link..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl bg-card border-border/50"
          />
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="rounded-2xl border-border/50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/40 text-muted-foreground/50 mb-3">
            <Inbox size={32} />
          </div>
          <h3 className="text-lg font-bold text-foreground">No requests found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {search
              ? `No requests match "${search}". Try clearing your search.`
              : `There are currently no ${statusFilter !== 'all' ? statusFilter : ''} manga requests.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3.5">
          <AnimatePresence>
            {filteredRequests.map(req => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="rounded-2xl border-border/50 bg-card hover:shadow-lg transition-all">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      {/* Left info */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-lg font-extrabold text-foreground leading-tight">
                            {req.title}
                          </h3>
                          <Badge
                            className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wider border ${
                              req.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : req.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}
                          >
                            {req.status}
                          </Badge>
                        </div>

                        {req.alt_title && (
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <span className="font-bold text-foreground/70">Alt:</span> {req.alt_title}
                          </p>
                        )}

                        {req.source_url && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                            <a
                              href={req.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline font-medium truncate flex items-center gap-1"
                            >
                              {req.source_url}
                              <ExternalLink className="h-3 w-3 inline shrink-0 opacity-70" />
                            </a>
                          </div>
                        )}

                        {req.notes && (
                          <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 text-xs text-muted-foreground flex items-start gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
                            <span className="leading-relaxed whitespace-pre-wrap">{req.notes}</span>
                          </div>
                        )}

                        {req.admin_notes && (
                          <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
                            <span className="font-bold">Admin Note:</span> {req.admin_notes}
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {req.user_email || 'Guest User'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(req.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Right action buttons */}
                      <div className="flex items-center gap-2 shrink-0 md:self-start pt-2 md:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(req.title, req.id)}
                          className="rounded-xl h-9 text-xs gap-1.5"
                          title="Copy title"
                        >
                          {copiedId === req.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          Copy Title
                        </Button>

                        {req.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setActiveRequest(req)
                                setActionType('approve')
                                setAdminNoteInput('')
                              }}
                              className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveRequest(req)
                                setActionType('reject')
                                setAdminNoteInput('')
                              }}
                              className="rounded-xl h-9 text-xs font-bold gap-1.5 text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
                            >
                              <XCircle size={14} /> Reject
                            </Button>
                          </>
                        )}

                        {req.status !== 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(req, 'pending')}
                            className="rounded-xl h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Re-open
                          </Button>
                        )}

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(req.id)}
                          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                          title="Delete request"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Action Dialog (Approve / Reject with Notes) */}
      <Dialog open={!!activeRequest} onOpenChange={open => { if (!open) setActiveRequest(null) }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Approve Request
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-500" /> Reject Request
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {activeRequest && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 text-xs">
                <p className="font-bold text-foreground">{activeRequest.title}</p>
                {activeRequest.alt_title && <p className="text-muted-foreground mt-0.5">{activeRequest.alt_title}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  {actionType === 'approve' ? 'Admin Note (Optional)' : 'Rejection Reason / Note'}
                </label>
                <Input
                  placeholder={
                    actionType === 'approve'
                      ? 'e.g. Added to MangaDex / MangaUpdates successfully'
                      : 'e.g. Duplicate title or already exists as...'
                  }
                  value={adminNoteInput}
                  onChange={e => setAdminNoteInput(e.target.value)}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setActiveRequest(null)}
              disabled={processing}
              className="rounded-xl text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (activeRequest && actionType) {
                  handleUpdateStatus(activeRequest, actionType === 'approve' ? 'approved' : 'rejected', adminNoteInput.trim() || undefined)
                }
              }}
              disabled={processing}
              className={`rounded-xl font-bold ${
                actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {processing ? 'Saving...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
