YouTube Search Supabase Edge Function
====================================

Purpose
-------
This function proxies YouTube search requests so the API key can stay secret on the server.

Important environment secrets
-----------------------------
- `YOUTUBE_API_KEY` (required) — YouTube Data API v3 key
- `ALLOWED_ORIGIN` (optional) — a single origin (e.g., `https://nyra-ai-56.lovable.app`) to restrict CORS. If not set, `*` is used.

Deploy (Supabase CLI)
---------------------
1. Ensure you have the Supabase CLI installed and authenticated.
2. Set secrets:

```bash
supabase secrets set YOUTUBE_API_KEY="<your-youtube-api-key>"
supabase secrets set ALLOWED_ORIGIN="https://nyra-ai-56.lovable.app"
```

3. Deploy the function:

```bash
supabase functions deploy youtube-search
```

4. (Optional) Test locally with the CLI:

```bash
# run the function server locally
supabase functions serve
```

Testing CORS and the function
----------------------------
Preflight (OPTIONS) test:

```bash
curl -i -X OPTIONS 'https://<project>.supabase.co/functions/v1/youtube-search' \
  -H 'Origin: https://nyra-ai-56.lovable.app' \
  -H 'Access-Control-Request-Method: GET'
```

GET request test:

```bash
curl -i 'https://<project>.supabase.co/functions/v1/youtube-search?q=course+promo+lifestyle' \
  -H 'Origin: https://nyra-ai-56.lovable.app'
```

Notes & Security
----------------
- For production, set `ALLOWED_ORIGIN` to the exact origin of your frontend to limit CORS surface area.
- Do not store the YouTube API key in client code or in your repo.
- Consider rate limiting and caching (e.g., Cloudflare or function-side caching) to reduce YouTube API calls.
