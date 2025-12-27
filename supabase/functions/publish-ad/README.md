Publish Ad (user draft) Supabase Edge Function
===============================================

This function accepts a POST with { id } and will mark an earlier user-added ad as `published = true`.

Behavior:
- Requires Authorization header with a valid Supabase access token (Bearer).
- Performs a quick billing check: returns 402 if the user's metadata does not indicate a paid plan (`user_metadata.is_paid === true` or `user_metadata.plan !== 'free'`).
- Uses the Supabase service role key to update `user_added_ads` row and return the updated row representation.

Required secrets (set via supabase CLI):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Deploy:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service role key>"
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase functions deploy publish-ad
```