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

// Edge function tester state and helper
  const [edgeUrl, setEdgeUrl] = useState<string>("")
  const [edgeResponse, setEdgeResponse] = useState<string>("")
  const [edgeLoading, setEdgeLoading] = useState<boolean>(false)

  async function sendToEdge() {
    if (!edgeUrl) return
    setEdgeLoading(true)
    setEdgeResponse('')
    try {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      })
      const text = await res.text()
      setEdgeResponse(`Status: ${res.status}\n\n${text}`)
    } catch (err) {
      setEdgeResponse(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEdgeLoading(false)
    }
  }

  const shown = useMemo(() => {
    const base = useDynamic ? results : curated;
    let list = base;
    if (activeCategory !== "All") list = list.filter((v) => (v.category ?? "General") === activeCategory);
    if (shortOnly) list = list.filter((v) => (typeof v.durationSec === 'number' ? v.durationSec <= 10 : false));
    return list;
  }, [useDynamic, results, activeCategory, shortOnly]);

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

          {/* Edge function tester: send a direct request to a deployed function and see raw response */}
          <div className="mt-4 border-t pt-4">
            <label className="text-sm text-muted-foreground">Edge Function URL (optional)</label>
            <div className="flex gap-2 mt-2">
              <Input placeholder="https://<project>.supabase.co/functions/v1/video-search" value={edgeUrl} onChange={(e) => setEdgeUrl((e.target as HTMLInputElement).value)} />
              <Button onClick={sendToEdge} disabled={!edgeUrl || edgeLoading}>
                {edgeLoading ? 'Sending...' : 'Send to Edge Function'}
              </Button>
              <Button variant="ghost" onClick={() => { setEdgeUrl(''); setEdgeResponse(''); }}>
                Clear
              </Button>
            </div>
            {edgeResponse && (
              <pre className="mt-3 max-h-48 overflow-auto bg-slate-900/5 p-3 text-xs rounded">{edgeResponse}</pre>
            )}
          </div>
        </div>

        {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

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
                    <Button size="sm" onClick={() => setSelected(v)}>Preview</Button>
                    {v.thumbnail && <img src={v.thumbnail} alt="thumb" className="w-20 h-12 object-cover rounded" />}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setSelected(null)}>
            <div className="bg-white p-4 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
              </div>
              {selected.sourceUrl ? (
                <VideoPlayer src={selected.sourceUrl} />
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
