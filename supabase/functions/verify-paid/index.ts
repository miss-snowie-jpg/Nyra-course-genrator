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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    if (!SUPABASE_URL) return new Response(JSON.stringify({ error: 'Supabase config missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authorization required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })

    const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authHeader } })
    if (!ures.ok) return new Response(JSON.stringify({ error: 'Invalid auth token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    const ujson = await ures.json()

    // First try Dodo-based verification if configured
    const DODO_API_KEY = Deno.env.get('DODO_API_KEY')
    const DODO_PRODUCT_ID = Deno.env.get('DODO_PRODUCT_ID')
    const DODO_API_BASE = Deno.env.get('DODO_API_BASE') || 'https://api.dodopayments.com/v1'

    const email = ujson?.email || ujson?.user?.email || (ujson?.user_metadata && ujson.user_metadata.email)

    if (DODO_API_KEY && DODO_PRODUCT_ID) {
      try {
        if (!email) {
          console.warn('verify-paid: user email not available for Dodo verification')
        } else {
          // Best-effort Dodo check: query payments endpoint for the product and customer email
          const url = `${DODO_API_BASE}/payments?product_id=${encodeURIComponent(DODO_PRODUCT_ID)}&customer_email=${encodeURIComponent(email)}`
          const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${DODO_API_KEY}`, 'Content-Type': 'application/json' } })
          if (res.ok) {
            const j = await res.json().catch(() => null)
            // Accept if any payment object indicates success (best-effort keys)
            const payments = Array.isArray(j) ? j : (j?.data || [])
            const ok = payments.some((p: Record<string, unknown>) => {
              const s = String(p.status || p.state || p.result || '').toLowerCase()
              return s === 'succeeded' || s === 'paid' || s === 'completed' || s === 'success'
            })
            if (ok) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          } else {
            console.warn('Dodo verify responded', res.status, await res.text().catch(() => ''))
          }
        }
      } catch (e) {
        console.error('Dodo verify error', e)
      }
    }

    // Fallback: Billing check: accept either user_metadata.is_paid === true or user_metadata.plan !== 'free'
    const isPaid = (ujson?.user_metadata && (ujson.user_metadata.is_paid === true || (ujson.user_metadata.plan && ujson.user_metadata.plan !== 'free')))
    if (!isPaid) {
      return new Response(JSON.stringify({ error: 'Payment required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('verify-paid error', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
