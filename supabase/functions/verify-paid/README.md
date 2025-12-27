Verify Paid (Edge Function)
===========================

This function verifies whether the current authenticated user is on a paid plan.

Behavior:
- Expects an Authorization header (Bearer token).
- Returns 200 { ok: true } if the user has `user_metadata.is_paid === true` or `user_metadata.plan !== 'free'`.
- Returns 402 if payment is required.

Required secrets (optional Dodo integration):
- `SUPABASE_URL` (required)
- `DODO_API_KEY` (optional) — Dodo API key used to verify product purchases. If set, this function will call Dodo to confirm payment for `DODO_PRODUCT_ID`.
- `DODO_PRODUCT_ID` (optional) — Product ID in Dodo to check against.
- `DODO_API_BASE` (optional) — Base URL for the Dodo API (defaults to `https://api.dodopayments.com/v1`).

Deploy:
```bash
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
# Optional (Dodo):
supabase secrets set DODO_API_KEY="<your-dodo-api-key>"
supabase secrets set DODO_PRODUCT_ID="<your-product-id>"
# Optionally override base URL for testing
supabase secrets set DODO_API_BASE="https://test.dodopayments.com/api"

supabase functions deploy verify-paid
```

Notes & rotation:
- To rotate Dodo credentials, update the `DODO_API_KEY` secret via `supabase secrets set DODO_API_KEY="<new-key>"` and remove the old key. Avoid committing keys to source control.
- The Dodo check is best-effort and uses a generic payments endpoint; if your Dodo account uses a different verification endpoint or response shape, provide `DODO_API_BASE` and I can adjust the endpoint and parsing accordingly.
