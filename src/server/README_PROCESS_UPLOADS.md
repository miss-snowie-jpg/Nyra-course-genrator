Upload Processor Worker

This worker processes uploads in the `AdUpload` table:
- Downloads raw uploaded files from `ads-raw` bucket
- Uses ffmpeg to transcode to MP4 (H.264) and create a thumbnail
- Uploads processed video to `ads` and thumbnail to `ads-thumbs`
- Inserts an `Ad` row and marks `AdUpload.processed = true`

Requirements
- Node 18+
- ffmpeg and ffprobe installed and on PATH
- Environment variables set in worker environment:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY

Install dependencies
  npm install node-fetch @supabase/supabase-js fluent-ffmpeg fs-extra

Run locally (example)
  SUPABASE_URL="https://<project>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" node ./dist/server/processUploads.js

Production
- Run as a persistent worker (PM2/systemd/container) or schedule periodically.
- For higher reliability, use a queue and multiple workers.

Notes
- For production-grade processing, consider using serverless transcoding services or a container with ffmpeg and scalability features.
- Ensure bucket names `ads-raw`, `ads`, `ads-thumbs` exist and have appropriate permissions.
