import React, { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import VideoPlayer from "@/components/AdLibrary/VideoPlayer";

type Video = {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category?: string;
  sourceUrl?: string | null;
  durationSec?: number | null;
};

// Curated fallback list (kept small as a fallback)
const curated: Video[] = [
  { id: "sample-1", title: "Rich Lifestyle Montage", description: "Fast-paced lifestyle montage with premium visuals", category: "Lifestyle" },
  { id: "sample-2", title: "Stylish Lifestyle Ad", description: "A lifestyle-focused ad with premium vibes", category: "Lifestyle" },
  { id: "ig-DQKbFomj8Da", title: "Instagram Short Ad", description: "Instagram post: DQKbFomj8Da", category: "Lifestyle", sourceUrl: "https://www.instagram.com/p/DQKbFomj8Da/", durationSec: 8 },
  { id: "ig-DSvDQqMjZW8", title: "Instagram Reel Ad", description: "Instagram reel: DSvDQqMjZW8", category: "Lifestyle", sourceUrl: "https://www.instagram.com/reel/DSvDQqMjZW8/?igsh=MWtseTM0ZDN6andzcQ==", durationSec: 9 },
  { id: "ig-DSuJeLnjJlO", title: "Instagram Reel Ad", description: "Instagram reel: DSuJeLnjJlO", category: "Lifestyle", sourceUrl: "https://www.instagram.com/reel/DSuJeLnjJlO/?igsh=NmQ0cjdkbjltYWJv", durationSec: 9 },
  { id: "sample-3", title: "Aspirational Travel Ad", description: "Adventure and high-end travel visuals", category: "Lifestyle" },
  { id: "sample-4", title: "Bold Headline Ad", description: "Bold, energetic promo", category: "General" },
];

const AdVideos = () => {
    const [useDynamic, setUseDynamic] = useState<boolean>(true);
    const [query, setQuery] = useState<string>("course promo lifestyle");
    const [results, setResults] = useState<Video[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pageToken, setPageToken] = useState<string | null>(null);
    const [prevPageToken, setPrevPageToken] = useState<string | null>(null);
    const [selected, setSelected] = useState<Video | null>(null);

  // Drafts (user-added, unpublished)
  type DraftRow = { id: string; title?: string; description?: string; thumbnail?: string; source_url?: string; created_at?: string }
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState<boolean>(false)
  const [editingDraft, setEditingDraft] = useState<DraftRow | null>(null)

  // Optional local API key for testing in environments without a server-side secret
  // No YouTube API key required. The app searches the internal ad library and user-submitted ads.
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [shortOnly, setShortOnly] = useState<boolean>(true);

    // Available categories for filtering
    const categories = useMemo(() => ["All", "Lifestyle", "General", "Explainer"], []);

    type VideoSearchItem = { id: string; title: string; description?: string; thumbnail?: string; category?: string; sourceUrl?: string }
    type VideoSearchResponse = { items?: VideoSearchItem[]; nextPageToken?: string | null; prevPageToken?: string | null; error?: string }

    const fetchVideos = async (opts?: { q?: string; token?: string }) => {
      setLoading(true);
      setError(null);

      try {
        // Call server-side Edge Function `video-search` to query the internal Ad Library
        const body = { q: opts?.q ?? query, pageToken: opts?.token ?? null };
        const { data, error: fnError } = await supabase.functions.invoke<VideoSearchResponse>('video-search', { body });
        if (fnError) throw fnError;

        if (data && data.error) throw new Error(data.error);

        const items = (data?.items ?? []) as VideoSearchItem[];
        const vids: Video[] = items.map((it) => ({
          id: it.id,
          title: it.title,
          description: it.description ?? '',
          thumbnail: it.thumbnail,
          category: it.category,
          sourceUrl: it.sourceUrl ?? null,
        }));

        setResults(vids);
        setPrevPageToken(data?.prevPageToken ?? null);
        setPageToken(data?.nextPageToken ?? null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Failed to fetch videos');

        // Final fallback: curated list
        setResults(curated);
        setPrevPageToken(null);
        setPageToken(null);
      } finally {
        setLoading(false);
      }
  };

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPageToken(null);
    setPrevPageToken(null);
    fetchVideos({ q: query });
  };

  const onNext = () => {
    if (!pageToken) return;
    fetchVideos({ token: pageToken });
  };
  const onPrev = () => {
    if (!prevPageToken) return;
    fetchVideos({ token: prevPageToken });
  };

  // Fetch current user's drafts (user_added_ads where published=false)
  const fetchMyDrafts = async () => {
    setLoadingDrafts(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setDrafts([])
        setLoadingDrafts(false)
        return
      }
      // Types for custom table aren't available in the generated supabase client; ignore the type-check here
      // @ts-expect-error - table not present in generated types
      const { data, error } = await supabase.from('user_added_ads').select('*').eq('user_id', session.user.id).eq('published', false).order('created_at', { ascending: false })
      if (error) throw error
      setDrafts((data ?? []) as DraftRow[])
    } catch (err) {
      console.error('fetch drafts error', err)
    } finally { setLoadingDrafts(false) }
  }

  // Import a shown video as a draft (unpublished)
  const importAsDraft = async (v: Video) => {
    try {
      const body = { url: v.sourceUrl, title: v.title, description: v.description, thumbnail: v.thumbnail, published: false }
      const res = await supabase.functions.invoke<{ inserted?: DraftRow }>('add-ad', { body })
      if (res.error) throw res.error
      const inserted = res.data?.inserted
      if (inserted) {
        // refresh drafts and open edit modal
        await fetchMyDrafts()
        setEditingDraft(inserted)
      }
    } catch (err) {
      console.error('import error', err)
      alert('Failed to import draft')
    }
  }

  const updateDraft = async (payload: { id: string; title?: string; description?: string; thumbnail?: string; source_url?: string }) => {
    try {
      const res = await supabase.functions.invoke<{ updated?: DraftRow }>('update-ad', { body: payload })
      if (res.error) throw res.error
      if (res.data && res.data.updated) {
        await fetchMyDrafts()
        setEditingDraft(null)
      }
    } catch (err) {
      console.error('update draft error', err)
      alert('Failed to update draft')
    }
  }

  const publishDraft = async (id: string) => {
    try {
      const res = await supabase.functions.invoke<{ ok?: boolean }>('publish-ad', { body: { id } })
      if (res.error) throw res.error
      if (res.data && res.data.ok) {
        await fetchMyDrafts()
        alert('Published')
      }
    } catch (err: unknown) {
      console.error('publish error', err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(msg || 'Failed to publish. Make sure you have a paid plan.')
    }
  }

// Edge function tester removed (dev-only UI); kept production code paths intact


  const shown = useMemo(() => {
    const base = useDynamic ? results : curated;
    let list = base;
    if (activeCategory !== "All") list = list.filter((v) => (v.category ?? "General") === activeCategory);
    if (shortOnly) list = list.filter((v) => (typeof v.durationSec === 'number' ? v.durationSec <= 10 : false));
    return list;
  }, [useDynamic, results, activeCategory, shortOnly]);

  // Fetch drafts on mount and when auth state changes
  useEffect(() => {
    const loadDrafts = async () => {
      setLoadingDrafts(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setDrafts([]); setLoadingDrafts(false); return }
        // @ts-expect-error - table not present in generated types
        const { data, error } = await supabase.from('user_added_ads').select('*').eq('user_id', session.user.id).eq('published', false).order('created_at', { ascending: false })
        if (error) throw error
        setDrafts((data ?? []) as DraftRow[])
      } catch (e) {
        console.error('load drafts error', e)
      } finally {
        setLoadingDrafts(false)
      }
    }

    loadDrafts()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadDrafts()
    })
    return () => subscription.unsubscribe()
  }, [])


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">Ad Video Library</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="mb-4 text-muted-foreground">Search the Ad Library (curated + user-submitted ads). Results are loaded per page and support pagination.</p>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={onSearch} className="flex gap-2 w-full md:max-w-xl">
            <Input value={query} onChange={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder="Search e.g. 'course promo lifestyle'" />
            <Button type="submit" className="whitespace-nowrap">Search</Button>
            <Button variant={useDynamic ? "ghost" : "secondary"} onClick={() => { setUseDynamic(!useDynamic); setResults([]); }}>
              {useDynamic ? 'Using library search' : 'Using curated list'}
            </Button>
          </form>

          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Category:</div>
            <div className="flex gap-2">
              {categories.map((c) => (
                <button key={c} className={`rounded-full px-3 py-1 text-sm ${activeCategory === c ? 'bg-primary text-white' : 'bg-muted/10 text-muted-foreground'}`} onClick={() => setActiveCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="ml-4 flex items-center gap-2">
              <input id="shortOnly" type="checkbox" checked={shortOnly} onChange={(e) => setShortOnly(e.target.checked)} />
              <label htmlFor="shortOnly" className="text-sm text-muted-foreground">Only ≤10s</label>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-md border border-border p-4">
          <p className="text-sm mb-0">Searches are performed against the internal Ad Library (curated + submitted). No external API keys are required.</p>


        </div>

        {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

        {/* My Drafts */}
        {drafts.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">My Drafts</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d) => (
                <Card key={d.id} className="p-0 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="mb-1 text-lg font-semibold">{d.title || 'Untitled'}</h3>
                      <span className="text-xs rounded-full bg-muted/10 px-2 py-1">Draft</span>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{d.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setEditingDraft(d)}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => publishDraft(d.id)}>Publish</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(shown.length === 0 && !loading) ? (
            <div className="text-muted-foreground">No videos to show. Try searching or switch to curated list.</div>
          ) : (
            shown.map((v) => (
              <Card key={v.id} className="p-0 overflow-hidden">
                <div className="aspect-video w-full bg-black relative">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">No preview available</div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button className="pointer-events-auto rounded-full bg-white/90 p-3 shadow" onClick={() => setSelected(v)}>Play</button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="mb-1 text-lg font-semibold">{v.title}</h3>
                    <span className="text-xs rounded-full bg-muted/10 px-2 py-1">{v.category ?? 'General'}</span>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{v.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setSelected(v)}>Preview</Button>
                      {v.sourceUrl && (
                        <Button size="sm" variant="ghost" onClick={() => importAsDraft(v)}>Import as Draft</Button>
                      )}
                    </div>
                    {v.thumbnail && <img src={v.thumbnail} alt="thumb" className="w-20 h-12 object-cover rounded" />}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {editingDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setEditingDraft(null)}>
            <div className="bg-white p-4 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-between">
                <div />
                <Button variant="ghost" onClick={() => setEditingDraft(null)}>Close</Button>
              </div>

              <div className="space-y-3">
                <Input value={editingDraft.title || ''} onChange={(e) => setEditingDraft({ ...editingDraft, title: (e.target as HTMLInputElement).value })} placeholder="Title" />
                <Input value={editingDraft.thumbnail || ''} onChange={(e) => setEditingDraft({ ...editingDraft, thumbnail: (e.target as HTMLInputElement).value })} placeholder="Thumbnail URL" />
                <Input value={editingDraft.source_url || ''} onChange={(e) => setEditingDraft({ ...editingDraft, source_url: (e.target as HTMLInputElement).value })} placeholder="Source URL" />
                <textarea className="w-full rounded border p-2" value={editingDraft.description || ''} onChange={(e) => setEditingDraft({ ...editingDraft, description: (e.target as HTMLTextAreaElement).value })} placeholder="Description" />

                <div className="flex gap-2">
                  <Button onClick={() => updateDraft({ id: editingDraft.id, title: editingDraft.title, description: editingDraft.description, thumbnail: editingDraft.thumbnail, source_url: editingDraft.source_url })}>Save Draft</Button>
                  <Button variant="secondary" onClick={() => publishDraft(editingDraft.id)}>Publish</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setSelected(null)}>
            <div className="bg-white p-4 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              </div>
              {selected.sourceUrl ? (
                <VideoPlayer src={selected.sourceUrl} adId={selected.id} />
              ) : (
                <div className="p-6">No preview available for this ad.</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-4">
          <Button onClick={onPrev} disabled={!prevPageToken || loading}>Previous</Button>
          <div className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'Page'}</div>
          <Button onClick={onNext} disabled={!pageToken || loading}>Next</Button>
        </div>
      </main>
    </div>
  );
};

export default AdVideos;
