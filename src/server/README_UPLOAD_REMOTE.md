API route: Upload remote video to YouTube and record in Prisma

File: `api/upload-remote-video.ts` (Next.js/Vercel style)

Overview
- POST /api/upload-remote-video
  - Headers: `x-auth-token: <AUTH_TOKEN>` (AUTH_TOKEN environment variable required)
  - Body: { url: string, title?: string }
  - Action: downloads remote URL, streams to YouTube via googleapis (YouTube v3), stores result in Prisma `Video` table

Env vars required
- CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN: YouTube OAuth2 creds
- AUTH_TOKEN: simple bearer token for route access control
- DATABASE_URL: your Postgres connection string (Prisma)

Notes
- This implementation streams the remote asset directly into YouTube (no local disk). Ensure remote URL supports streaming/download.
- Serverless platforms may have time and memory limits; for large videos consider a worker or uploading via a multi-step approach.
- The route attempts to use `@prisma/adapter-pg` if available; otherwise it falls back to a standard PrismaClient.

Prisma model (add to `prisma/schema.prisma` if you don't have a `Video` model)

model Video {
  id         String   @id @default(uuid())
  title      String?
  youtubeUrl String?
  status     String   @default("PENDING")
  remoteUrl  String?
  uploadedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([status])
  @@index([youtubeUrl])
}

Migration
- After adding the model, run:
  npx prisma generate
  npx prisma migrate dev --name add_video_model

Security
- Keep `AUTH_TOKEN` secret and only call the route from trusted automation.
- Consider additional checks (IP allowlist, OAuth service account) for production.

Limitations & improvements
- Improve robust quota/error handling for YouTube uploads.
- Use a background worker to retry failed uploads and to handle larger files.
- Consider uploading to a storage bucket and allowing resumable uploads if needed.
