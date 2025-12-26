#!/usr/bin/env node
/*
Fetch up to N short ads (≤10s) from Supabase and download their processed video files to ./videos.
This script no longer queues uploads to YouTube; it simply downloads assets for review or manual handling.
Env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Optional: MAX_UPLOADS (default 6)
*/





const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAX_UPLOADS = parseInt(process.env.MAX_UPLOADS || '6', 10)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const VIDEOS_DIR = path.join(process.cwd(), 'videos')
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true })

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function main() {
  // Query Ads: short (<=10s), published, not queued, not uploaded
  const qUrl = `${SUPABASE_URL}/rest/v1/Ad?durationSec=lte.10&published=eq.true&youtubeQueuedAt=is.null&youtubeUploadedAt=is.null&select=id,sourceUrl,title&order=createdAt.asc&limit=${MAX_UPLOADS}`
  console.log('Querying:', qUrl)
  const res = await fetch(qUrl, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Query failed: ${res.status} ${t}`)
  }
  const ads = await res.json()
  if (!ads || !ads.length) {
    console.log('No eligible ads found')
    return
  }

  for (const ad of ads) {
    try {
      const { id, sourceUrl, title } = ad
      if (!sourceUrl) {
        console.log('Ad missing sourceUrl:', id)
        continue
      }
      // Download remote asset
      console.log('Downloading:', id, sourceUrl)
      const r = await fetch(sourceUrl)
      if (!r.ok) {
        console.error('Failed to download', sourceUrl, r.status)
        continue
      }
      const filename = `${id}__${slugify(title || id)}.mp4`
      const filepath = path.join(VIDEOS_DIR, filename)
      const buffer = Buffer.from(await r.arrayBuffer())
      fs.writeFileSync(filepath, buffer)
      console.log('Saved to', filepath)

      // No longer marking YouTube queue fields; downloaded for manual handling or review
      // If you want to mark these rows in the DB (e.g., set `downloadedAt`), add a patch here.
    } catch (e) {
      console.error('Error handling ad', ad, e)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
