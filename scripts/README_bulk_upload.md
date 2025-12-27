Bulk upload MP4s to Supabase (Ad Library)

This script uploads all MP4s found in a local folder to Supabase Storage and creates an `Ad` row for each.

Prerequisites
- Node 18+
- Set environment variables:
  - SUPABASE_URL (e.g. https://<project>.supabase.co)
  - SUPABASE_SERVICE_ROLE_KEY (service role key with storage write/delete permissions)
- If you want trimming (--trim) or duration checks, install ffmpeg/ffprobe and ensure they are on PATH.

Usage

Upload files from the `videos` folder (default):

  SUPABASE_URL="https://<project>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<key>" node scripts/bulk-upload-mp4s.js --dir ./videos

Trim files longer than 10s automatically before uploading:

  SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/bulk-upload-mp4s.js --dir ./videos --trim

Skip files longer than 10s:

  SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/bulk-upload-mp4s.js --dir ./videos --skip-long

Notes
- Files are uploaded to the `ads` bucket under `processed/` by default and are made public via the Supabase storage public URL API.
- The script creates an `Ad` row for each uploaded file with `published: true` so previews and downloads are immediately available.
- If you prefer the worker-based processing pipeline (upload to `ads-raw` and let `processUploads` do the transcode + thumbnail + Ad creation), tell me and I can add a `--raw` flag that will enqueue `AdUpload` rows instead.
