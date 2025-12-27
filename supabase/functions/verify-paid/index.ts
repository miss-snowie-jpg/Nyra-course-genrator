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
    const deno = (globalThis as unknown as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno
    const SUPABASE_URL = deno?.env?.get('SUPABASE_URL')
    if (!SUPABASE_URL) return new Response(JSON.stringify({ error: 'Supabase config missing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })

    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Authorization required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })

    const ures = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: authHeader } })
    if (!ures.ok) return new Response(JSON.stringify({ error: 'Invalid auth token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    const ujson = await ures.json()

    // Billing check: accept either user_metadata.is_paid === true or user_metadata.plan !== 'free'
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