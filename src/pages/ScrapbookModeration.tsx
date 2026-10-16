import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, AlertTriangle, ExternalLink, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Screenshot {
  id: string;
  user_id: string;
  manga_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  is_spoiler: boolean;
}

export default function ScrapbookModeration() {
  const [images, setImages] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('manga_screenshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setImages(data || []);
    } catch (error: any) {
      toast.error('Failed to load images: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('manga_screenshots')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setImages(prev => prev.filter(img => img.id !== id));
      toast.success('Image deleted successfully.');
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendWarning = async (userId: string, imageId: string, imageUrl: string) => {
    const reason = prompt('Enter warning reason (sent to user):', 'Your uploaded image violates our community guidelines. If this happens again, your account will be permanently banned and you will lose everything.');
    if (!reason) return;

    setProcessingId(imageId);
    try {
      // First, create the warning notification
      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: userId,
          title: '⚠️ Content Warning',
          message: reason,
          type: 'alert',
          is_read: false,
          metadata: { image_url: imageUrl }
        });

      if (notifError) throw notifError;

      // Automatically delete the offending image
      const { error: delError } = await supabase.from('manga_screenshots').delete().eq('id', imageId);
      if (delError) throw delError;

      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Warning sent and image removed!');
    } catch (error: any) {
      toast.error('Failed to send warning: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scrapbook Moderation</h1>
          <p className="text-muted-foreground">Review user-uploaded manga panels and enforce guidelines.</p>
        </div>
        <button onClick={fetchImages} className="px-4 py-2 bg-secondary rounded-md text-sm font-medium hover:bg-secondary/80">
          Refresh List
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
          <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold">Queue is clear!</h3>
          <p className="text-sm text-muted-foreground">No recent images to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((img) => (
            <div key={img.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-square bg-secondary">
                <img 
                  src={img.image_url} 
                  alt="User upload" 
                  className="w-full h-full object-cover"
                />
                <a 
                  href={img.image_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="absolute top-2 right-2 bg-black/60 p-1.5 rounded text-white hover:bg-black/80"
                  title="View full size"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="p-4 flex-1 flex flex-col text-sm space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold truncate" title={img.manga_id}>Manga: {img.manga_id}</span>
                  <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground whitespace-nowrap">
                    {new Date(img.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground break-all">User: {img.user_id}</p>
                {img.caption && (
                  <div className="bg-secondary/50 p-2 rounded text-xs italic line-clamp-2 mt-2">
                    "{img.caption}"
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex gap-2 pt-4 border-t border-border/50">
                  <button 
                    onClick={() => handleDeleteImage(img.id)}
                    disabled={processingId === img.id}
                    className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-600 rounded-md hover:bg-rose-500/20 transition-colors text-xs font-semibold cursor-pointer"
                  >
                    {processingId === img.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </button>
                  <button 
                    onClick={() => handleSendWarning(img.user_id, img.id, img.image_url)}
                    disabled={processingId === img.id}
                    className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-600 rounded-md hover:bg-amber-500/20 transition-colors text-xs font-semibold cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Warn User
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
