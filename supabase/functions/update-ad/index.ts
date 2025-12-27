// @ts-expect-error: Deno std types are available in the Edge runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders, status: 204 })

  try {
    const body = await req.json().catch(() => ({}))
    const adId = body?.id
    if (!adId) return new Response(JSON.stringify({ error: 'Missing ad id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })

    const deno = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno
    const SUPABASE_URL = deno?.env?.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return new Response(JSON.stringify({ error: 'Supabase config missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })

    // Require Authorization header to identify user
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authorization required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })

    // Fetch user info
    const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authHeader } })
    if (!ures.ok) return new Response(JSON.stringify({ error: 'Invalid auth token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    const ujson = await ures.json()
    const userId = ujson?.id

    // Verify ownership: fetch existing row
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/user_added_ads?id=eq.${encodeURIComponent(adId)}&select=*`, {
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    })
    if (!getRes.ok) return new Response(JSON.stringify({ error: 'Failed to fetch ad' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
    const rows = await getRes.json()
    if (!Array.isArray(rows) || rows.length === 0) return new Response(JSON.stringify({ error: 'Ad not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })
    const row = rows[0]
    if (row.user_id !== userId) return new Response(JSON.stringify({ error: 'Not allowed to update this ad' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })

    // Prepare update payload: allow title, description, thumbnail, source_url
    type Payload = { title?: string; description?: string; thumbnail?: string; source_url?: string; updated_at?: string }
    const payload: Payload = {}
    if (body.title !== undefined) payload.title = String(body.title)
    if (body.description !== undefined) payload.description = String(body.description)
    if (body.thumbnail !== undefined) payload.thumbnail = String(body.thumbnail)
    if (body.source_url !== undefined) payload.source_url = String(body.source_url)
    payload.updated_at = new Date().toISOString()

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/user_added_ads?id=eq.${encodeURIComponent(adId)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload),
    })

    if (!updateRes.ok) {
      const txt = await updateRes.text()
      console.error('update failed', updateRes.status, txt)
      return new Response(JSON.stringify({ error: 'Failed to update ad', detail: txt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
    }

    const updated = await updateRes.json()
    return new Response(JSON.stringify({ ok: true, updated: updated[0] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('update-ad error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})