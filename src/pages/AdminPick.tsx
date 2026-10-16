import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Crown, Loader2, Save, Search, Image as ImageIcon } from 'lucide-react';

interface AdminPick {
  id: string;
  manga_id: string;
  title: string;
  cover_url: string;
  message: string;
  is_active: boolean;
  extra_images?: string[];
}

interface SearchResult {
  id: string;
  title: string;
  coverImage: string;
  source: string;
}

export default function AdminPick() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [currentPick, setCurrentPick] = useState<AdminPick | null>(null);

  // Form State
  const [mangaId, setMangaId] = useState('');
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [message, setMessage] = useState('');
  const [extraImages, setExtraImages] = useState(''); // Comma separated

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchSource, setSearchSource] = useState('anilist'); // 'anilist' or 'mangadex'

  useEffect(() => {
    fetchCurrentPick();
  }, []);

  const fetchCurrentPick = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_picks')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        let extra_images: string[] = Array.isArray(data.extra_images) ? data.extra_images : [];
        let cleanMessage = data.message || '';
        
        if (cleanMessage.includes('<!--EXTRA_IMAGES:')) {
          const match = cleanMessage.match(/<!--EXTRA_IMAGES:(.*?)-->/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (Array.isArray(parsed) && extra_images.length === 0) {
                extra_images = parsed;
              }
              cleanMessage = cleanMessage.replace(/<!--EXTRA_IMAGES:.*?-->/, '').trim();
            } catch (e) {
              // ignore
            }
          }
        }

        const parsedData = {
          ...data,
          message: cleanMessage,
          extra_images
        };

        setCurrentPick(parsedData);
        setMangaId(parsedData.manga_id);
        setTitle(parsedData.title);
        setCoverUrl(parsedData.cover_url);
        setMessage(parsedData.message || '');
        setExtraImages((parsedData.extra_images || []).join(', '));
      }
    } catch (err: any) {
      toast.error('Failed to load current pick: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      let results: SearchResult[] = [];
      
      if (searchSource === 'anilist' || searchSource === 'all') {
        const query = `
          query ($search: String) {
            Page(page: 1, perPage: 10) {
              media(search: $search, type: MANGA) {
                id
                title { romaji english }
                coverImage { large }
              }
            }
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { search: searchQuery } })
        });
        const json = await res.json();
        const aniResults = (json.data?.Page?.media || []).map((m: any) => ({
          id: m.id.toString(),
          title: m.title.english || m.title.romaji,
          coverImage: m.coverImage.large,
          source: 'AniList'
        }));
        results = [...results, ...aniResults];
      }
      
      if (searchSource === 'mangadex' || searchSource === 'all') {
        const params = new URLSearchParams({ title: searchQuery, limit: '10' });
        params.append('includes[]', 'cover_art');
        params.append('contentRating[]', 'safe');
        params.append('contentRating[]', 'suggestive');
        params.append('contentRating[]', 'erotica');
        
        const res = await fetch(`https://api.mangadex.org/manga?${params.toString()}`);
        const json = await res.json();
        
        const mdResults = (json.data || []).map((m: any) => {
          const coverArt = m.relationships.find((r: any) => r.type === 'cover_art');
          const fileName = coverArt?.attributes?.fileName;
          const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg` : '';
          
          return {
            id: m.id,
            title: m.attributes.title.en || Object.values(m.attributes.title)[0] || 'Unknown',
            coverImage: coverUrl,
            source: 'MangaDex'
          };
        });
        results = [...results, ...mdResults];
      }

      setSearchResults(results);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const selectManga = (manga: SearchResult) => {
    setMangaId(manga.id);
    setTitle(manga.title);
    setCoverUrl(manga.coverImage);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleDisable = async () => {
    if (!currentPick) return;
    if (!confirm("Are you sure you want to turn off the Admin's Choice? It will be removed from all users' libraries.")) return;
    setDisabling(true);
    try {
      const { error } = await supabase.from('admin_picks').update({ is_active: false }).eq('is_active', true);
      if (error) throw error;
      toast.success("Admin's Choice turned off.");
      setCurrentPick(null);
      setMangaId('');
      setTitle('');
      setCoverUrl('');
      setMessage('');
      setExtraImages('');
    } catch (err: any) {
      toast.error('Failed to disable: ' + err.message);
    } finally {
      setDisabling(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supabase.from('admin_picks').update({ is_active: false }).eq('is_active', true);
      const extraImagesArray = extraImages.split(',').map(s => s.trim()).filter(s => s.startsWith('http'));
      
      const payload: any = {
        manga_id: mangaId,
        title,
        cover_url: coverUrl,
        message,
        is_active: true,
        extra_images: extraImagesArray
      };
      
      let { error } = await supabase.from('admin_picks').insert(payload);
      
      // If extra_images column does not exist in schema cache, fallback to embedding in message
      if (error && (error.message?.includes('extra_images') || error.details?.includes('extra_images') || error.code === 'PGRST204')) {
        const embeddedMessage = extraImagesArray.length > 0 
          ? `${message}\n<!--EXTRA_IMAGES:${JSON.stringify(extraImagesArray)}-->`
          : message;

        const fallbackPayload: any = {
          manga_id: mangaId,
          title,
          cover_url: coverUrl,
          message: embeddedMessage,
          is_active: true
        };

        const fallbackRes = await supabase.from('admin_picks').insert(fallbackPayload);
        error = fallbackRes.error;
      }

      if (error) throw error;
      toast.success("Admin's Pick updated successfully!");
      fetchCurrentPick();
    } catch (err: any) {
      toast.error('Failed to save pick: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  const extraImagesArray = extraImages.split(',').map(s => s.trim()).filter(s => s.startsWith('http'));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="text-amber-500 h-6 w-6" /> Admin's Choice
        </h1>
        <p className="text-muted-foreground mt-1">Select a manga to feature across all users' libraries in a special red box.</p>
      </div>

      {/* Search Section */}
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">Search Manga (Auto-fill)</h2>
          <select 
            value={searchSource} 
            onChange={e => setSearchSource(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Sources</option>
            <option value="anilist">AniList</option>
            <option value="mangadex">MangaDex</option>
          </select>
        </div>
        
        <div className="flex gap-2">
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search to auto-fill..."
          />
          <button onClick={handleSearch} disabled={searching} className="bg-secondary text-foreground px-4 py-2 rounded-md hover:bg-secondary/80 flex items-center gap-2">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="grid gap-2 mt-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {searchResults.map((res, i) => (
              <div key={`${res.source}-${res.id}-${i}`} onClick={() => selectManga(res)} className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg cursor-pointer border border-transparent hover:border-border">
                <img src={res.coverImage} alt="cover" className="h-14 w-10 object-cover rounded bg-muted" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{res.title}</div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">{res.source}</span>
                    <span>ID: {res.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleSave} className="space-y-4 bg-card p-6 rounded-xl border border-border">
          <div>
            <label className="block text-sm font-semibold mb-1">Manga ID</label>
            <input 
              required
              type="text" 
              value={mangaId} 
              onChange={e => setMangaId(e.target.value)} 
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. 12345 or some-uuid"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Title</label>
            <input 
              required
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="The Greatest Estate Developer"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Cover Image URL</label>
            <input 
              required
              type="url" 
              value={coverUrl} 
              onChange={e => setCoverUrl(e.target.value)} 
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Extra Images (Optional, comma-separated URLs)</label>
            <input 
              type="text" 
              value={extraImages} 
              onChange={e => setExtraImages(e.target.value)} 
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://img1.jpg, https://img2.jpg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Your Message (Optional)</label>
            <textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              placeholder="Why should everyone read this?"
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button 
              type="submit" 
              disabled={saving || disabling}
              className="flex-1 flex justify-center items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-bold transition-colors"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
              Publish
            </button>
            
            {currentPick && (
              <button 
                type="button"
                onClick={handleDisable}
                disabled={saving || disabling}
                className="flex-none flex justify-center items-center gap-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-md font-bold transition-colors border border-rose-500"
                title="Turn Off Admin's Choice"
              >
                {disabling ? <Loader2 className="animate-spin h-4 w-4" /> : 'Turn Off'}
              </button>
            )}
          </div>
        </form>

        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Live Preview</h3>
          {coverUrl && title ? (
            <div className="border-2 border-rose-500 bg-rose-500/5 p-4 rounded-xl shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg z-10 flex items-center gap-1 shadow-sm">
                <Crown className="h-3 w-3" /> Admin's Choice
              </div>
              <div className="flex gap-4">
                <div className="w-24 h-36 shrink-0 rounded-lg overflow-hidden border border-rose-500/20 shadow-md">
                  <img src={coverUrl} alt={title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h4 className="font-bold text-lg leading-tight line-clamp-2 text-rose-500">{title}</h4>
                  {message ? (
                    <p className="text-xs text-muted-foreground italic line-clamp-4 bg-background/50 p-2 rounded-md border border-border/50">"{message}"</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Highly recommended reading!</p>
                  )}
                </div>
              </div>
              
              {extraImagesArray.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {extraImagesArray.map((url, idx) => (
                    <img key={idx} src={url} alt="extra" className="h-16 w-auto rounded border border-border object-cover shadow-sm" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground text-sm">
              Fill out the form to see a preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
