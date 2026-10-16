import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Search, FolderHeart, ShieldAlert, Check, X, RefreshCw, Trash2, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

export default function CollectionsPage() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const loadCollections = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })

    if (error) {
      toast.error('Failed to load collections')
    } else {
      setCollections(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadCollections()
  }, [])

  const toggleNSFW = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.rpc('admin_toggle_collection_nsfw', {
      p_collection_id: id,
      p_is_nsfw: !currentStatus
    })

    if (error) {
      toast.error('Failed to update NSFW status')
    } else {
      toast.success(currentStatus ? 'Collection marked as Safe' : 'Collection marked as NSFW')
      setCollections(prev => prev.map(c => c.id === id ? { ...c, is_nsfw: !currentStatus } : c))
    }
  }

  const deleteCollection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collection?')) return;
    
    const { error } = await supabase.rpc('admin_delete_collection', {
      p_collection_id: id
    })

    if (error) {
      toast.error('Failed to delete collection')
    } else {
      toast.success('Collection deleted')
      setCollections(prev => prev.filter(c => c.id !== id))
    }
  }

  const filtered = collections.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.user_name && c.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground">Manage user collections and moderation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCollections} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] items-center gap-4 border-b border-border/50 bg-muted/50 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div>Collection</div>
              <div>User</div>
              <div>Visibility</div>
              <div>Created</div>
              <div className="text-right">Actions</div>
            </div>
            
            <div className="divide-y divide-border/50">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading collections...
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No collections found</div>
              ) : (
                filtered.map((c) => (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={c.id} 
                    className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] items-center gap-4 p-4 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FolderHeart className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.title}</div>
                        <div className="text-xs text-muted-foreground truncate font-medium">{c.category || 'General'}</div>
                      </div>
                    </div>
                    
                    <div className="truncate font-medium text-muted-foreground">
                      {c.user_name || 'Unknown'}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={c.is_public ? 'default' : 'secondary'} className="text-[10px] font-bold">
                        {c.is_public ? 'Public' : 'Private'}
                      </Badge>
                      {c.is_nsfw && (
                        <Badge variant="destructive" className="text-[10px] font-bold gap-1 bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20">
                          <EyeOff className="h-3 w-3" /> NSFW
                        </Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground text-xs font-medium">
                      {formatDate(c.created_at)}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant={c.is_nsfw ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleNSFW(c.id, c.is_nsfw)}
                        className={`h-8 gap-1.5 px-3 text-xs font-bold rounded-lg ${c.is_nsfw ? 'bg-rose-500 hover:bg-rose-600 text-white border-transparent shadow-md shadow-rose-500/20' : 'border-rose-500/30 text-rose-500 hover:bg-rose-500/10'}`}
                        title={c.is_nsfw ? 'Mark as Safe' : 'Mark as NSFW'}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {c.is_nsfw ? 'Mark Safe' : 'Mark NSFW'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteCollection(c.id)}
                        title="Delete Collection"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
