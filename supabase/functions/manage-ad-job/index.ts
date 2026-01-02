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
    const { adId, type, intervalMin, action } = body || {}
    if (!adId) return new Response(JSON.stringify({ error: 'adId is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })

    // Use Supabase REST to create/update ad_jobs table
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return new Response(JSON.stringify({ error: 'Supabase config missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })

    // Enforce authentication: require an Authorization: Bearer <token> header and validate it
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Authorization required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authHeader, 'apikey': SUPABASE_SERVICE_KEY } })
    if (!userRes.ok) return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    const user = await userRes.json()
    const userId = user?.id
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })

    // Helper: check that the authenticated user owns the ad (if ad record has user_id). Deny if not owner.
    async function assertOwnerOrDeny(adIdToCheck: string | number) {
      const ares = await fetch(`${SUPABASE_URL}/rest/v1/Ad?id=eq.${encodeURIComponent(String(adIdToCheck))}&select=user_id`, { headers: new Headers({ 'apikey': SUPABASE_SERVICE_KEY ?? '', 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY ?? ''}` }) })
      if (ares.ok) {
        const arr = await ares.json()
        const adRec = Array.isArray(arr) ? arr[0] : arr
        if (adRec && adRec.user_id && adRec.user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 })
        }
      }
      return null
    }

    if (action === 'stop') {
      const ownerCheck = await assertOwnerOrDeny(adId)
      if (ownerCheck) return ownerCheck

      const r = await fetch(`${SUPABASE_URL}/rest/v1/ad_jobs?adId=eq.${adId}`, { method: 'PATCH', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }), })
      const text = await r.text()
      if (!r.ok) return new Response(JSON.stringify({ error: 'Failed to stop job', detail: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })
      return new Response(JSON.stringify({ ok: true, message: 'Stopped' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create or update job for adId/type
    const typeVal = type || 'REPOST'
    const interval = intervalMin || 1440

    const ownerCheck = await assertOwnerOrDeny(adId)
    if (ownerCheck) return ownerCheck

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/ad_jobs`, { method: 'POST', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ adId, type: typeVal, intervalMin: interval, active: true }) })
    const text = await upsertRes.text()
    if (!upsertRes.ok) return new Response(JSON.stringify({ error: 'Failed to upsert job', detail: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 })

    return new Response(JSON.stringify({ ok: true, body: JSON.parse(text) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('manage-ad-job error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
