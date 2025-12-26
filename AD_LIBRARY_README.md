Ad Library Module — Integration Notes
===================================

Summary
-------
This module adds an Ad Library for browsing curated ad videos. Files added:

- Prisma schema: `prisma/schema.prisma` (models: `Ad`, `Tag`, `UserSavedAds`)
- Server ingestion service: `src/server/fetchAdVideos.ts` (upserts ads via Prisma)
- Frontend components: `src/components/AdLibrary/AdCard.tsx`, `Filters.tsx`, `VideoPlayer.tsx`
- Pages: `src/pages/AdLibrary.tsx`, `AdLibraryDetail.tsx`, `AdLibraryFavorites.tsx`

Design choices (brief)
- Prisma schema: explicit `Ad` and `Tag` models with `Platform` enum. Prisma chosen for developer ergonomics and type-safety.
- Ingestion service: `fetchAdVideos()` is modular and only stores metadata (no large binary downloads). Keeps responsibilities separated: ingestion vs serving.
- Frontend: reusable components (`AdCard`, `Filters`, `VideoPlayer`) styled with Tailwind for consistency with the app.
- Free vs paid: client-side placeholder uses Supabase session as a quick heuristic. Replace with billing-aware server checks for production.

How to wire the backend (Prisma + Postgres)
-----------------------------------------
1. Ensure `DATABASE_URL` is set in your environment to the Postgres instance used by Nyra.
2. Install Prisma client and dependencies:

```bash
npm install prisma @prisma/client
npx prisma generate
```

3. Run a migration to create the tables:

```bash
npx prisma migrate dev --name add_ad_library
```

4. Run the ingestion service on a schedule (cron, GitHub Actions, or a serverless function). Example (local run):

```bash
node -e "require('./src/server/runIngest').runIngest && node ./dist/server/runIngest.js"
```

Daily ingest:
- Configure feed URLs in `src/server/ad-sources.json`.
- A GitHub Actions workflow `.github/workflows/ingest-daily.yml` runs `src/server/runIngest.ts` daily and inserts up to 6 new ads per run. Set `DATABASE_URL` in GitHub Secrets for the workflow to work.

Daily uploads to YouTube: (disabled)
- YouTube upload automation has been removed. The system now accepts user-supplied remote URLs which are enqueued for download and processing. Use the Supabase Edge Function `add-ad` or the API route `POST /api/upload-remote-video` (requires `AUTH_TOKEN`) to enqueue links; the `processUploads` worker will download, validate (≤10s), transcode, and create `Ad` records.

New: Add-by-URL flow
--------------------
We added a Supabase Edge Function `add-ad` that accepts POST requests with `{ url }` to ingest user-provided video URLs. It attempts to extract metadata (oEmbed or YouTube Data API) and saves to the `user_added_ads` table (SQL included in `supabase/functions/add-ad/README.md`). This flow auto-publishes ads and is intended for quick inclusion of user-supplied links.

Notes about Supabase functions
-----------------------------
This repo contains a Supabase Edge Function `video-search` that queries the internal Ad Library (if you implement it, see `supabase/functions/video-search`). The Ad Library frontend will attempt to call a deployed function at `/supabase/functions/v1/video-search`.

Security & production TODOs
--------------------------
- Do not expose `YOUTUBE_API_KEY` to clients; use a serverless proxy function.
- Move favorites writing from direct Supabase client usage in the browser to a secured server endpoint that validates auth and writes via Prisma.
- Add rate limiting and retries to `fetchAdVideos()` and use a robust feed parser.
- Add automated thumbnail caching and a CDN for downloads.

AI Remix (future)
-----------------
- TODO: Add a `/ad-library/:id/remix` endpoint that uses AI to create derivative cuts and captions.
- TODO: Add a remix job queue and asset storage; store remix metadata linked to original `Ad`.

Files added
-----------
- `prisma/schema.prisma`
- `src/server/fetchAdVideos.ts`
- `src/components/AdLibrary/AdCard.tsx`
- `src/components/AdLibrary/Filters.tsx`
- `src/components/AdLibrary/VideoPlayer.tsx`
- `src/pages/AdLibrary.tsx`
- `src/pages/AdLibraryDetail.tsx`
- `src/pages/AdLibraryFavorites.tsx`

Next steps I can take
---------------------
- Implement locked server endpoints using Prisma for favorites and ad queries.
- Wire `fetchAdVideos()` into a scheduled runner and add more adapters (TikTok, Meta).
- Add unit/integration tests for ingestion and components.

If you want me to proceed with any of the next steps, tell me which one to prioritize.
