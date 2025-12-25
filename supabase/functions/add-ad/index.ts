// @ts-expect-error: Deno std types are available in the Edge runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const url = body?.url
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url in request body' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // Simple metadata extractor: support YouTube links via oEmbed or YouTube Data API
    // Prefer server-side YT key via YOUTUBE_API_KEY env for more reliable metadata
    const deno = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno
    const YT_KEY = deno?.env?.get('YOUTUBE_API_KEY')
    type Meta = { sourceUrl: string; title: string; description?: string; thumbnail?: string; platform?: string }
    const meta: Meta = { sourceUrl: url, title: '', description: '', thumbnail: '', platform: 'UNKNOWN' }

    // YouTube link detection
    try {
      const u = new URL(url)
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
        meta.platform = 'YOUTUBE'
        // Try oEmbed first
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const r = await fetch(oembedUrl)
        if (r.ok) {
          const data = await r.json()
          meta.title = data.title || ''
          meta.description = data.author_name ? `By ${data.author_name}` : ''
          meta.thumbnail = data.thumbnail_url
        } else if (YT_KEY) {
          // Fallback to YouTube Data API search by url's video id
          // Extract videoId
          let videoId = ''
          if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1)
          else videoId = u.searchParams.get('v') || ''
          if (videoId) {
            const apiUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
            apiUrl.searchParams.set('key', YT_KEY)
            apiUrl.searchParams.set('part', 'snippet,contentDetails')
            apiUrl.searchParams.set('id', videoId)
            const yres = await fetch(apiUrl.toString())
            if (yres.ok) {
              const jd = await yres.json()
              const it = jd.items?.[0]
              if (it) {
                meta.title = it.snippet?.title || ''
                meta.description = it.snippet?.description || ''
                meta.thumbnail = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url
              }
            }
          }
        }
      } else {
        // Generic oEmbed try
        const oe = `https://noembed.com/embed?url=${encodeURIComponent(url)}`
        const r = await fetch(oe)
        if (r.ok) {
          const d = await r.json()
          meta.title = d.title || ''
          meta.description = d.author_name ? `By ${d.author_name}` : ''
          meta.thumbnail = d.thumbnail_url || ''
        }
      }
    } catch (e) {
      // ignore metadata extraction errors
      console.error('metadata extraction error', e)
    }

    // Insert into Supabase table `user_added_ads` (SQL table must exist)
    const deno2 = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno
    const SUPABASE_URL = deno2?.env?.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = deno2?.env?.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Supabase config missing on function' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }

    // Compose row
    const row = {
      title: body?.title || meta.title || '',
      description: body?.description || meta.description || '',
      source_url: url,
      thumbnail: body?.thumbnail || meta.thumbnail || null,
      platform: body?.platform || meta.platform || 'UNKNOWN',
      source_type: 'USER_URL',
      published: true,
      created_at: new Date().toISOString(),
    }

    // Use Supabase REST to insert row
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_added_ads`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(row),
    })

    if (!insertRes.ok) {
      const text = await insertRes.text()
      console.error('insert error', insertRes.status, text)
      return new Response(JSON.stringify({ error: 'Failed to save ad', detail: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
    }

    const inserted = await insertRes.json()
    return new Response(JSON.stringify({ ok: true, inserted: inserted[0] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('add-ad error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
