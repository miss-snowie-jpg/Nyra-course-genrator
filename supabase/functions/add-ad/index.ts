// add-ad Supabase Edge Function removed
// This function was part of the Ad Library which has been removed.
// Keep a minimal handler so deployments referencing this file won't fail.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(() => new Response(JSON.stringify({ error: 'add-ad function removed' }), { 
  status: 410, 
  headers: { 'Content-Type': 'application/json' } 
}))
