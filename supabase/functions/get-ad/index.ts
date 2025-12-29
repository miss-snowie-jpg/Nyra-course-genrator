// get-ad Supabase Edge Function removed on 2025-12-29
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "600",
};

serve(() => new Response(JSON.stringify({ error: 'get-ad function removed' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
