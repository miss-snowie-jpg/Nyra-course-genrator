Get Ad Supabase Edge Function

This function returns a single Ad record by id. It is meant to be used by the frontend to obtain `sourceUrl` and other metadata required for preview/download.

Usage:

- Deploy:
  supabase functions deploy get-ad

- Set required secrets (on Supabase):
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
  supabase secrets set SUPABASE_URL="https://<project>.supabase.co"

- Example:
  curl 'https://<project>.supabase.co/functions/v1/get-ad?id=<AD_ID>'

Responses:
  { ok: true, ad: { id, title, sourceUrl, thumbnail, ... } }
  { error: 'Ad not found' }
