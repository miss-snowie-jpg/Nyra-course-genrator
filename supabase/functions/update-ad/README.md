Update Ad (user draft) Supabase Edge Function
=============================================

This function accepts a POST containing editable fields plus `{ id }` and updates the `user_added_ads` row if the requesting user is the owner.

Behavior:
- Requires Authorization header with a valid Supabase access token (Bearer).
- Verifies the `user_id` on the existing row matches the authenticated user.
- Allows updating `title`, `description`, `thumbnail`, and `source_url`.

Required secrets (set via supabase CLI):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Deploy:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service role key>"
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase functions deploy update-ad
```