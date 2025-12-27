// The Supabase Edge runtime provides Deno and `serve` from the std library at runtime.
// For local TypeScript checking, silence module resolution and declare a minimal Deno env.
// @ts-expect-error: Deno std types are available in the Edge runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Use `globalThis.Deno` at runtime; avoid declaring Deno to prevent duplicate identifier issues in the workspace TS config.



// Allow configuration of the origin via a secret `ALLOWED_ORIGIN` (set to a specific origin to restrict CORS; if unset, '*' is used)
const configuredOrigin = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno?.env?.get('ALLOWED_ORIGIN') || '*'

function buildCorsHeaders(origin: string | null) {
  // If a specific origin is configured, only echo that origin when the request origin matches
  const isWildcard = configuredOrigin === '*'
  const allowOrigin = isWildcard ? '*' : (origin || configuredOrigin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  }
  if (!isWildcard) headers['Access-Control-Allow-Credentials'] = 'true'
  return headers
}

serve(async (req: Request) => {
  const reqOrigin = req.headers.get('origin')

  // If a specific origin is set and the request's origin doesn't match, reject the request.
  if (configuredOrigin !== '*' && reqOrigin && reqOrigin !== configuredOrigin) {
    // Minimal response without sensitive details
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), { headers: { 'Content-Type': 'application/json' }, status: 403 })
  }

  if (req.method === 'OPTIONS') {
    // Respond to preflight with 204 No Content and proper CORS headers
    return new Response(null, { headers: buildCorsHeaders(reqOrigin), status: 204 })
  }

  // Restrict methods to reduce attack surface
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { headers: { 'Content-Type': 'application/json' }, status: 405 })
  }

  try {
    const deno = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno
    const YOUTUBE_API_KEY = deno?.env?.get('YOUTUBE_API_KEY')
    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY is not set on the server' }), {
        headers: { ...buildCorsHeaders(reqOrigin), 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const isGet = req.method === 'GET'
    const params: Record<string, string | undefined> = {}

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
        headers: { ...buildCorsHeaders(reqOrigin), 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    type YTItem = { id: { videoId: string } | string; snippet: { title: string; description: string; thumbnails?: { medium?: { url: string }; default?: { url: string } } } }
    type YTResponse = { items?: YTItem[]; nextPageToken?: string; prevPageToken?: string }
    const data = await ytRes.json() as YTResponse

    const items = ((data.items ?? []) as YTItem[]).map((it) => {
      const id = typeof it.id === 'string' ? it.id : it.id.videoId
      const title = it.snippet?.title ?? ''
      const description = it.snippet?.description ?? ''
      const thumbnail = it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url
      const cat = ((title || description) as string).toLowerCase().includes('lifestyle') ? 'Lifestyle' : 'General'
      return { id, title, description, thumbnail, category: cat }
    })

    return new Response(JSON.stringify({ items, nextPageToken: data.nextPageToken ?? null, prevPageToken: data.prevPageToken ?? null }), {
      headers: { ...buildCorsHeaders(reqOrigin), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('youtube-search function error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...buildCorsHeaders(reqOrigin), 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})