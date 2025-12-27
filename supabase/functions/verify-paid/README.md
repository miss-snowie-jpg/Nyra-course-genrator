Verify Paid (Edge Function)
===========================

This function verifies whether the current authenticated user is on a paid plan.

Behavior:
- Expects an Authorization header (Bearer token).
- Returns 200 { ok: true } if the user has `user_metadata.is_paid === true` or `user_metadata.plan !== 'free'`.
- Returns 402 if payment is required.

Deploy:
```bash
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase functions deploy verify-paid
```