Add Ad (user URL) Supabase Edge Function
=======================================

This function accepts a POST with { url, title?, description?, thumbnail? } and inserts a row in the `user_added_ads` table. The function will try to fetch metadata via oEmbed or the YouTube Data API when applicable.

Required secrets (set via supabase CLI):
- SUPABASE_URL: your Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: service role key for server-side writes
- (optional) YOUTUBE_API_KEY: YouTube Data API key for richer metadata

SQL to create `user_added_ads` table (run in Supabase SQL editor):

```sql
create table if not exists public.user_added_ads (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  source_url text not null,
  thumbnail text,
  platform text,
  source_type text,
  published boolean default true,
  created_at timestamp with time zone default now()
);
```

Deploy:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service role key>"
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
supabase secrets set YOUTUBE_API_KEY="<yt key>"   # optional
supabase functions deploy add-ad
```

Test:
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/add-ad' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=RgKAFK5djSk"}'
```
