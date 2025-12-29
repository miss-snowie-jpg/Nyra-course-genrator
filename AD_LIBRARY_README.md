Ad Library Module — Integration Notes
===================================

Summary
-------
This module adds an Ad Library for browsing curated ad s. Files added:

- Prisma schema: `prisma/schema.prisma` (models: `Ad`, `Tag`, `UserSavedAds`)
- Server ingestion service: `src/server/fetchAds.ts` (upserts ads via Prisma)
- Frontend components: `src/components/AdLibrary/AdCard.tsx`, `Filters.tsx`, `Player.tsx`
- Pages: `src/pages/AdLibrary.tsx`, `AdLibraryDetail.tsx`, `AdLibraryFavorites.tsx`

Design choices (brief)
- Prisma schema: explicit `Ad` and `Tag` models with `Platform` enum. Prisma chosen for developer ergonomics and type-safety.
- Ingestion service: `fetchAds()` is modular and only stores metadata (no large binary downloads). Keeps responsibilities separated: ingestion vs serving.
- Frontend: reusable components (`AdCard`, `Filters`, `Player`) styled with Tailwind for consistency with the app.
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
- YouTube upload automation has been removed. The system now accepts user-supplied remote URLs which are enqueued for download and processing. Use the Supabase Edge Function `add-ad` or the API route `POST /api/upload-remote-` (requires `AUTH_TOKEN`) to enqueue links; the `processUploads` worker will download, validate (≤10s), transcode, and create `Ad` records.

New: Add-by-URL flow
--------------------
We added a Supabase Edge Function `add-ad` that accepts POST requests with `{ url }` to ingest user-provided  URLs. It attempts to extract metadata (oEmbed or YouTube Data API) and saves to the `user_added_ads` table (SQL included in `supabase/functions/add-ad/README.md`). This flow auto-publishes ads and is intended for quick inclusion of user-supplied links.

Notes about Supabase functions
-----------------------------
This repo contains a Supabase Edge Function `-search` that queries the internal Ad Library (if you implement it, see `supabase/functions/-search`). The Ad Library frontend will attempt to call a deployed function at `/supabase/functions/v1/-search`.

Security & production TODOs
--------------------------
- Do not expose `YOUTUBE_API_KEY` to clients; use a serverless proxy function.
- Move favorites writing from direct Supabase client usage in the browser to a secured server endpoint that validates auth and writes via Prisma.
- Add rate limiting and retries to `fetchAds()` and use a robust feed parser.
- Add automated thumbnail caching and a CDN for downloads.

AI Remix (future)
-----------------
- TODO: Add a `/ad-library/:id/remix` endpoint that uses AI to create derivative cuts and captions.
- TODO: Add a remix job queue and asset storage; store remix metadata linked to original `Ad`.

 Editor & Paid Export
--------------------------
- Implemented `Editor` component (browser-side FFmpeg.wasm) at `src/components/AdLibrary/Editor.tsx`.
  - Features: trim (start/end), text overlay (headline + CTA), aspect ratio conversion (9:16, 1:1, 16:9), export -> downloadable MP4.
  - Uses `@ffmpeg/ffmpeg` in the browser (dynamic import); add `npm install @ffmpeg/ffmpeg` to your project.
- Billing & permissions: a Supabase Edge Function `verify-paid` was added (`supabase/functions/verify-paid`) and is used to restrict editing/export to paid users.
- Implementation notes & caveats:
  - The editor downloads the source  directly from the public internet URL in the browser. For large sources this can be slow and memory-heavy; for production consider server-side transient processing and signed storage for reliability.
  - Text overlay uses ffmpeg `drawtext`; some FFmpeg wasm builds may not include all text/font features. The implementation includes fallback behavior when filters are not available.
  - Exports are generated client-side and offered as a single downloadable MP4; Nyra does not post to social media on the user's behalf.

Future improvements (short-term):
- Server-side export fallback for very large s (streaming transcode worker to handle memory constraints).
- Add font selection and richer captions (animated overlays).
- Add server-side export signing to allow robust resumes and retries.

Files added
-----------
- `prisma/schema.prisma`
- `src/server/fetchAds.ts`
- `src/components/AdLibrary/AdCard.tsx`
- `src/components/AdLibrary/Filters.tsx`
- `src/components/AdLibrary/Player.tsx`
- `src/pages/AdLibrary.tsx`
- `src/pages/AdLibraryDetail.tsx`
- `src/pages/AdLibraryFavorites.tsx`

Next steps I can take
---------------------
- Implement locked server endpoints using Prisma for favorites and ad queries.
- Wire `fetchAds()` into a scheduled runner and add more adapters (TikTok, Meta).
- Add unit/integration tests for ingestion and components.

If you want me to proceed with any of the next steps, tell me which one to prioritize.
