import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Save, RefreshCw, Loader2, Link2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface SiteNoticeData {
  id: number
  show_notice: boolean
  message: string
  bg_color: string
  text_color: string
  is_sticky: boolean
  is_dismissible: boolean
  show_link: boolean
  link_text?: string
  link_url?: string
}

export default function SiteNoticePage() {
  const [notice, setNotice] = useState<SiteNoticeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadNotice = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_notice').select('*').eq('id', 1).single()
    setNotice(data || null)
    setLoading(false)
  }

  useEffect(() => { loadNotice() }, [])

  const saveNotice = async () => {
    if (!notice) return
    setSaving(true)
    const { error } = await supabase.from('site_notice').update(notice).eq('id', 1)
    setSaving(false)
    if (error) {
      toast.error('Failed to save notice')
    } else {
      toast.success('Site notice updated')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 max-w-2xl rounded-2xl" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Site Notice</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure the global banner shown on all pages</p>
        </div>
        <button onClick={loadNotice} className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <Card className="max-w-2xl rounded-2xl border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Bell className="h-4 w-4 text-primary" /> Notice Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {notice ? (
            <>
              {/* Toggle notice */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Enable Notice</h3>
                  <p className="text-xs text-muted-foreground">Toggle banner visibility globally</p>
                </div>
                <Switch checked={notice.show_notice} onCheckedChange={v => setNotice({ ...notice, show_notice: v })} />
              </div>

              {/* Dismissible */}
              <div className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
                <div>
                  <h4 className="text-sm font-semibold">Dismissible</h4>
                  <p className="text-xs text-muted-foreground">Users can close the notice</p>
                </div>
                <Switch checked={notice.is_dismissible} onCheckedChange={v => setNotice({ ...notice, is_dismissible: v })} />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message</label>
                <Input
                  value={notice.message}
                  onChange={e => setNotice({ ...notice, message: e.target.value })}
                  className="h-11 rounded-xl bg-secondary/50 border-none"
                  placeholder="Welcome to MangaLoop!"
                />
              </div>

              {/* Action Link */}
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Action Link</h4>
                    <p className="text-xs text-muted-foreground">Show a clickable link in the banner</p>
                  </div>
                  <Switch checked={notice.show_link} onCheckedChange={v => setNotice({ ...notice, show_link: v })} />
                </div>
                {notice.show_link && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Link Text</label>
                      <Input value={notice.link_text || ''} onChange={e => setNotice({ ...notice, link_text: e.target.value })} className="h-11 rounded-xl bg-secondary/50 border-none" placeholder="Click Here" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">URL</label>
                      <Input value={notice.link_url || ''} onChange={e => setNotice({ ...notice, link_url: e.target.value })} className="h-11 rounded-xl bg-secondary/50 border-none" placeholder="https://..." />
                    </div>
                  </div>
                )}
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Background</label>
                  <div className="flex gap-2">
                    <Input type="color" value={notice.bg_color} onChange={e => setNotice({ ...notice, bg_color: e.target.value })} className="h-11 w-12 p-1 rounded-xl bg-secondary/50 border-none cursor-pointer" />
                    <Input value={notice.bg_color} onChange={e => setNotice({ ...notice, bg_color: e.target.value })} className="h-11 flex-1 rounded-xl bg-secondary/50 border-none font-mono text-xs uppercase" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Text</label>
                  <div className="flex gap-2">
                    <Input type="color" value={notice.text_color} onChange={e => setNotice({ ...notice, text_color: e.target.value })} className="h-11 w-12 p-1 rounded-xl bg-secondary/50 border-none cursor-pointer" />
                    <Input value={notice.text_color} onChange={e => setNotice({ ...notice, text_color: e.target.value })} className="h-11 flex-1 rounded-xl bg-secondary/50 border-none font-mono text-xs uppercase" />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Preview</label>
                <div className="rounded-xl py-3 px-4 text-center text-sm font-bold shadow-md" style={{ backgroundColor: notice.bg_color, color: notice.text_color }}>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                    <span>{notice.message || 'No message'}</span>
                    {notice.show_link && notice.link_text && (
                      <span className="underline font-bold opacity-90">{notice.link_text}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Save */}
              <Button onClick={saveNotice} disabled={saving} className="w-full h-11 rounded-xl font-bold shadow-lg shadow-primary/20 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save Notice Settings'}
              </Button>
            </>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Notice settings not found. Run the SQL migration first.</p>
              <Button variant="outline" onClick={() => setNotice({ id: 1, show_notice: false, message: 'Welcome to MangaLoop!', bg_color: '#ef4444', text_color: '#ffffff', is_sticky: true, is_dismissible: true, show_link: false })}>
                Initialize Default
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
