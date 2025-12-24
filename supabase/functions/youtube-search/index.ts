import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')
    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY is not set on the server' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const isGet = req.method === 'GET'
    let params: Record<string, string | undefined> = {}

    if (isGet) {
      const url = new URL(req.url)
      params.q = url.searchParams.get('q') ?? undefined
      params.pageToken = url.searchParams.get('pageToken') ?? undefined
    } else {
      const body = await req.json().catch(() => null)
      params.q = body?.q ?? undefined
      params.pageToken = body?.pageToken ?? undefined
    }

    const q = params.q ?? 'course promo lifestyle'
    const maxResults = 12

    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    apiUrl.searchParams.set('key', YOUTUBE_API_KEY)
    apiUrl.searchParams.set('part', 'snippet')
    apiUrl.searchParams.set('q', q)
    apiUrl.searchParams.set('maxResults', String(maxResults))
    apiUrl.searchParams.set('type', 'video')
    if (params.pageToken) apiUrl.searchParams.set('pageToken', params.pageToken)

    console.log('Proxying YouTube search:', q)

    const ytRes = await fetch(apiUrl.toString())
    if (!ytRes.ok) {
      const text = await ytRes.text()
      console.error('YouTube API error', ytRes.status, text)
      return new Response(JSON.stringify({ error: `YouTube API error: ${ytRes.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    const data = await ytRes.json()

    const items = (data.items || []).map((it: any) => ({
      id: it.id.videoId,
      title: it.snippet.title,
      description: it.snippet.description,
      thumbnail: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url,
      category: it.snippet.title.toLowerCase().includes('lifestyle') || it.snippet.description.toLowerCase().includes('lifestyle') ? 'Lifestyle' : 'General',
    }))

    return new Response(JSON.stringify({ items, nextPageToken: data.nextPageToken ?? null, prevPageToken: data.prevPageToken ?? null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('youtube-search function error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})