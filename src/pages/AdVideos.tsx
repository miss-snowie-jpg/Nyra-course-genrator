import React, { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Video = {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category?: string;
};

// Curated fallback list (kept small as a fallback)
const curated: Video[] = [
  { id: "9bZkp7q19f0", title: "Rich Lifestyle Montage", description: "Fast-paced lifestyle montage with premium visuals", category: "Lifestyle" },
  { id: "RgKAFK5djSk", title: "Stylish Lifestyle Ad", description: "A lifestyle-focused ad with premium vibes", category: "Lifestyle" },
  { id: "60ItHLz5WEA", title: "Aspirational Travel Ad", description: "Adventure and high-end travel visuals", category: "Lifestyle" },
  { id: "kXYiU_JCYtU", title: "Bold Headline Ad", description: "Bold, energetic promo", category: "General" },
];

const AdVideos = () => {
    const [useDynamic, setUseDynamic] = useState<boolean>(true);
    const [query, setQuery] = useState<string>("course promo lifestyle");
    const [results, setResults] = useState<Video[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pageToken, setPageToken] = useState<string | null>(null);
    const [prevPageToken, setPrevPageToken] = useState<string | null>(null);

  // Optional local API key for testing in environments without a server-side secret
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("youtube_api_key")
    if (saved) setApiKeyInput(saved)
  }, [])
    const [activeCategory, setActiveCategory] = useState<string>("All");

    // Available categories for filtering
    const categories = useMemo(() => ["All", "Lifestyle", "General", "Explainer"], []);

    type YouTubeSearchItem = { id: string; title: string; description?: string; thumbnail?: string; category?: string }
    type YouTubeSearchResponse = { items?: YouTubeSearchItem[]; nextPageToken?: string | null; prevPageToken?: string | null; error?: string }

    const fetchVideos = async (opts?: { q?: string; token?: string }) => {
      setLoading(true);
      setError(null);

      try {
        // Call server-side Supabase function to keep API key secret
        const body = { q: opts?.q ?? query, pageToken: opts?.token ?? null };
        const { data, error: fnError } = await supabase.functions.invoke<YouTubeSearchResponse>('youtube-search', { body });
        if (fnError) throw fnError;

        if (data && data.error) throw new Error(data.error);

        const items = (data?.items ?? []) as YouTubeSearchItem[];
        const vids: Video[] = items.map((it) => ({
          id: it.id,
          title: it.title,
          description: it.description ?? '',
          thumbnail: it.thumbnail,
          category: it.category,
        }));

        setResults(vids);
        setPrevPageToken(data?.prevPageToken ?? null);
        setPageToken(data?.nextPageToken ?? null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Failed to fetch videos");

        // Try client-side YouTube API using a local key (useful for local testing)
        const localKey = apiKeyInput || localStorage.getItem('youtube_api_key')
        if (localKey) {
          try {
            type YTSearchItem = { id: { videoId: string }; snippet: { title: string; description: string; thumbnails?: { medium?: { url: string }; default?: { url: string } } } }
            const apiUrl = new URL('https://www.googleapis.com/youtube/v3/search')
            apiUrl.searchParams.set('key', localKey)
            apiUrl.searchParams.set('part', 'snippet')
            apiUrl.searchParams.set('q', opts?.q ?? query)
            apiUrl.searchParams.set('maxResults', '12')
            apiUrl.searchParams.set('type', 'video')

            const ytRes = await fetch(apiUrl.toString())
            if (ytRes.ok) {
              const data = await ytRes.json()
              const vids: Video[] = (data.items || []).map((it: YTSearchItem) => ({
                id: it.id.videoId,
                title: it.snippet.title,
                description: it.snippet.description,
                thumbnail: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url,
                category: (it.snippet.title || it.snippet.description || '').toLowerCase().includes('lifestyle') ? 'Lifestyle' : 'General',
              }))
              setResults(vids)
              setPrevPageToken(data.prevPageToken ?? null)
              setPageToken(data.nextPageToken ?? null)
              return
            }
          } catch (e) {
            // ignore and fall through to curated
          }
        }

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

  const saveApiKey = () => {
    localStorage.setItem("youtube_api_key", apiKeyInput.trim());
    setError(null);
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
    if (activeCategory === "All") return base;
    return base.filter((v) => (v.category ?? "General") === activeCategory);
  }, [useDynamic, results, activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">Ad Video Library</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="mb-4 text-muted-foreground">Search YouTube for course promo and lifestyle ads. Results are loaded 12 per page and support pagination.</p>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form onSubmit={onSearch} className="flex gap-2 w-full md:max-w-xl">
            <Input value={query} onChange={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder="Search e.g. 'course promo lifestyle'" />
            <Button type="submit" className="whitespace-nowrap">Search</Button>
            <Button variant={useDynamic ? "ghost" : "secondary"} onClick={() => { setUseDynamic(!useDynamic); setResults([]); }}>
              {useDynamic ? 'Using YouTube API' : 'Using curated list'}
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
          </div>
        </div>

        <div className="mb-6 rounded-md border border-border p-4">
          <p className="text-sm mb-2">The YouTube API key must be set as a server secret named <code>YOUTUBE_API_KEY</code> for the deployed site (Supabase function reads it from the environment). If you want me to set it as a Supabase secret now, tell me and I will add instructions or apply it for you.</p>

          {/* Local testing helper: store a temporary API key in localStorage (not for production) */}
          <div className="flex items-center gap-2 mt-2">
            <Input placeholder="Local YouTube API key (optional)" value={apiKeyInput} onChange={(e) => setApiKeyInput((e.target as HTMLInputElement).value)} />
            <Button onClick={saveApiKey}>Save</Button>
            <Button variant="ghost" onClick={() => { localStorage.removeItem('youtube_api_key'); setApiKeyInput(''); }}>Clear</Button>
          </div>

          {/* Edge function tester: send a direct request to a deployed function and see raw response */}
          <div className="mt-4 border-t pt-4">
            <label className="text-sm text-muted-foreground">Edge Function URL (optional)</label>
            <div className="flex gap-2 mt-2">
              <Input placeholder="https://<project>.supabase.co/functions/v1/youtube-search" value={edgeUrl} onChange={(e) => setEdgeUrl((e.target as HTMLInputElement).value)} />
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
                <div className="aspect-video w-full bg-black">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${v.id}`}
                    title={v.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="mb-1 text-lg font-semibold">{v.title}</h3>
                    <span className="text-xs rounded-full bg-muted/10 px-2 py-1">{v.category ?? 'General'}</span>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{v.description}</p>
                  <div className="flex justify-between items-center">
                    <Button asChild variant="ghost" size="sm">
                      <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">
                        Open on YouTube <ExternalLink className="inline-block ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    {v.thumbnail && <img src={v.thumbnail} alt="thumb" className="w-20 h-12 object-cover rounded" />}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

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
