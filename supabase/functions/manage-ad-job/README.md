Manage Ad Jobs (start/stop) Supabase Edge Function
==================================================

This function creates or updates ad_jobs rows and can also stop jobs.

Request body examples:
- Start or upsert a job (POST):
  {
    "adId": "<ad-id>",
    "type": "REPOST", // or REFRESH
    "intervalMin": 1440
  }

- Stop a job:
  {
    "adId": "<ad-id>",
    "action": "stop"
  }

Required secrets:
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL

SQL to create ad_jobs table (if not using Prisma migration):

```sql
create table if not exists public.ad_jobs (
  id uuid primary key default gen_random_uuid(),
  adId uuid not null,
  type text not null,
  intervalMin int default 1440,
  active boolean default true,
  lastRunAt timestamptz,
  createdAt timestamptz default now(),
  updatedAt timestamptz default now()
);
```

Deploy:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service role>"
supabase secrets set SUPABASE_URL="https://<project>.supabase.co"
supabase functions deploy manage-ad-job
```
