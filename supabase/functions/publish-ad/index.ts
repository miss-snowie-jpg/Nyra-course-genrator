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

    // Require Authorization header to determine user and billing
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authorization required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })

    // Fetch user from Supabase auth
    const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authHeader } })
    if (!ures.ok) return new Response(JSON.stringify({ error: 'Invalid auth token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    const ujson = await ures.json()
    const userId = ujson?.id

    // Billing check: accept either user_metadata.is_paid === true or user_metadata.plan !== 'free'
    const isPaid = (ujson?.user_metadata && (ujson.user_metadata.is_paid === true || (ujson.user_metadata.plan && ujson.user_metadata.plan !== 'free')))
    if (!isPaid) {
      return new Response(JSON.stringify({ error: 'Payment required to publish. Upgrade to a paid plan.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 })
    }

    // Update the user_added_ads row (only owner can publish)
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/user_added_ads?id=eq.${encodeURIComponent(adId)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ published: true, updated_at: new Date().toISOString() }),
    })

    if (!updateRes.ok) {
      const txt = await updateRes.text()
      console.error('publish update failed', updateRes.status, txt)
      return new Response(JSON.stringify({ error: 'Failed to publish ad', detail: txt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
    }

    const updated = await updateRes.json()
    // Ensure at least one row was updated
    if (!Array.isArray(updated) || updated.length === 0) {
      return new Response(JSON.stringify({ error: 'No ad updated (not found or not permitted)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
    }

    return new Response(JSON.stringify({ ok: true, updated: updated[0] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('publish-ad error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})