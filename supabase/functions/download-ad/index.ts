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
    const mode = url.searchParams.get('mode') // 'preview' or null for download
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

    const source = ad.sourceUrl || ad.source_url
    if (!source) return new Response(JSON.stringify({ error: 'No source URL for ad' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })

    // Helper to detect direct media URLs
    const isDirectMedia = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || u.startsWith('blob:') || u.includes('/storage/v1/object/public/')

    // If this is a preview request and the source is not a direct media URL, queue a processing job and respond 202
    if (mode === 'preview' && !isDirectMedia(source)) {
      // Check for an existing unprocessed AdUpload for this ad
      const q = `${SUPABASE_URL}/rest/v1/AdUpload?adId=eq.${encodeURIComponent(id)}&remote=eq.true&processed=eq.false`
      const qres = await fetch(q, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } })
      if (qres.ok) {
        const arr = await qres.json()
        if (arr && arr.length > 0) {
          return new Response(JSON.stringify({ status: 'queued' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 })
        }
      }

      // Insert AdUpload to enqueue the processing worker
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/AdUpload`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify([{ storagePath: source, remote: true, adId: id }])
      })
      if (!insertRes.ok) {
        const t = await insertRes.text().catch(() => '')
        console.error('failed to enqueue AdUpload', insertRes.status, t)
        return new Response(JSON.stringify({ error: 'Failed to enqueue processing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
      }

      return new Response(JSON.stringify({ status: 'queued' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 })
    }

    // For direct media sources (or processed public files) fetch and stream back the media.
    // On preview mode we return the video as inline (no Content-Disposition); on download we attach
    const isMedia = isDirectMedia(source)
    if (!isMedia && mode !== 'preview') {
      // For downloads: if not direct media, attempt to enqueue processing and inform client
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/AdUpload`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify([{ storagePath: source, remote: true, adId: id }])
      })
      return new Response(JSON.stringify({ status: 'queued' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 })
    }

    // At this point we should have a direct media URL (processed or original). Stream it back.
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
    })

    if (mode !== 'preview') {
      // enforce short-video policy for downloads
      const dur = ad.durationSec ?? ad.duration_sec ?? null
      if (typeof dur !== 'number' || dur > 10) {
        return new Response(JSON.stringify({ error: 'Downloads allowed only for short videos (≤10s)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
      }
      headers.set('Content-Disposition', `attachment; filename="${safeName}.mp4"`)
    }

    // Stream body (no attachment on preview)
    return new Response(remote.body, { headers })
  } catch (err) {
    console.error('download-ad error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
