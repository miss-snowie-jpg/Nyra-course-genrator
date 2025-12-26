API route: Enqueue a remote video URL for download & processing

File: `api/upload-remote-video.ts` (Next.js/Vercel style)

Overview
- POST /api/upload-remote-video
  - Headers: `x-auth-token: <AUTH_TOKEN>` (AUTH_TOKEN environment variable required)
  - Body: { url: string, filename?: string, userId?: string }
  - Action: records an `AdUpload` with `remote=true` and `storagePath` set to the provided URL. The `processUploads` worker will later download and process the asset (transcode, thumbnail, insert `Ad`).

Env vars required
- AUTH_TOKEN: simple bearer token for route access control
- DATABASE_URL: your Postgres connection string (Prisma)
- SUPABASE_* envs are required by the `processUploads` worker at runtime

Notes
- The endpoint enqueues the URL; it does NOT perform remote uploads to third-party services.
- The worker will validate duration (≤10s) and reject or mark uploads with errors if validation fails.
- Keep `AUTH_TOKEN` secret and call the route from trusted automation or dashboards.

Prisma notes
- This endpoint writes to the existing `AdUpload` table; no new models are required. If you prefer, you can create an `Ad` record beforehand and pass `adId` when creating the upload to attach the processed video to an existing Ad.

Limitations & improvements
- Add rate limiting and request validation to this route in production.
- Consider accepting an HMAC signature or client identity payload to authenticate different automation clients.
