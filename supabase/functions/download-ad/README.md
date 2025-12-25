Download Ad Edge Function

Purpose: Proxy-download short ads (≤10s). The function fetches an `Ad` record by id, enforces the short-video rule, fetches the remote asset, and streams it back as an attachment.

Deploy:
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
  supabase secrets set SUPABASE_URL="https://<project>.supabase.co"
  supabase functions deploy download-ad

Usage:
  Open in browser (signed-in users can call it):
    https://<project>.supabase.co/functions/v1/download-ad?id=<AD_ID>

Responses:
  - 200: streams video with attachment header
  - 403: if ad duration > 10s or not a short video
  - 404: ad not found or no source URL
  - 502/500: remote or server error

Notes:
  - This is a simple proxy for short videos. For production we recommend storing short assets in your storage bucket and returning signed URLs for reliability and caching. Optionally add server-side auth check to only allow paid users.
