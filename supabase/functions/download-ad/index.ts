// download-ad Supabase Edge Function removed on 2025-12-29
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(() => new Response(JSON.stringify({ error: 'download-ad function removed' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
