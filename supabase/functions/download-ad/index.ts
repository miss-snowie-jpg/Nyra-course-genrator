// @ts-expect-error: Deno std types are available in the Edge runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 })

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return new Response(JSON.stringify({ error: 'Missing id query param' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })

    const deno = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno
    const SUPABASE_URL = deno?.env?.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return new Response(JSON.stringify({ error: 'Supabase config missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })

    // Fetch ad record
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Ad?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Accept': 'application/json',
      }
    })

    if (!res.ok) {
      const t = await res.text()
      console.error('ad fetch error', res.status, t)
      return new Response(JSON.stringify({ error: 'Failed to fetch ad' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
    }

    const data = await res.json()
    const ad = Array.isArray(data) ? data[0] : data
    if (!ad) return new Response(JSON.stringify({ error: 'Ad not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })

    // Enforce short-video policy
    const dur = ad.durationSec ?? ad.duration_sec ?? null
    if (typeof dur !== 'number' || dur > 10) {
      return new Response(JSON.stringify({ error: 'Downloads allowed only for short videos (≤10s)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
    }

    const source = ad.sourceUrl || ad.source_url
    if (!source) return new Response(JSON.stringify({ error: 'No source URL for ad' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })

    // Proxy fetch the remote asset and stream it back as an attachment
    const remote = await fetch(source)
    if (!remote.ok) {
      const t = await remote.text().catch(() => '')
      console.error('remote fetch failed', remote.status, t)
      return new Response(JSON.stringify({ error: 'Failed to fetch remote asset' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
    }

    const contentType = remote.headers.get('content-type') || 'application/octet-stream'
    const safeName = (ad.title || `ad-${id}`).replace(/[^a-z0-9\-_. ]/gi, '_').slice(0, 120)
    const headers = new Headers({
      ...corsHeaders,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeName}.mp4"`,
    })

    return new Response(remote.body, { headers })
  } catch (err) {
    console.error('download-ad error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
