#!/usr/bin/env node
/*
Upload one .mp4 from ./videos to YouTube using googleapis.
- Uses env vars: CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN
- Optional env vars: DAILY_QUOTA (units), UPLOAD_COST (units)
- Maintains local quota file: .youtube-quota.json
- Moves uploaded file to ./done on success

Install:
  npm install googleapis
Run:
  CLIENT_ID=... CLIENT_SECRET=... REFRESH_TOKEN=... node upload.js

Notes:
- This script implements a local "Quota Check" using DAILY_QUOTA and a local usage file.
  For authoritative quota reporting, integrate Google Cloud Monitoring / Quota APIs.
*/

const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')

const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REFRESH_TOKEN = process.env.REFRESH_TOKEN
const DAILY_QUOTA = parseInt(process.env.DAILY_QUOTA || '10000', 10) // units per day
const UPLOAD_COST = parseInt(process.env.UPLOAD_COST || '1600', 10) // typical cost for a video upload

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Missing required env vars. Set CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN.')
  process.exit(1)
}

const VIDEOS_DIR = path.join(process.cwd(), 'videos')
const DONE_DIR = path.join(process.cwd(), 'done')
const QUOTA_FILE = path.join(process.cwd(), '.youtube-quota.json')

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

ensureDir(VIDEOS_DIR)
ensureDir(DONE_DIR)

function readQuota() {
  try {
    if (!fs.existsSync(QUOTA_FILE)) return { date: todayStr(), used: 0 }
    const raw = fs.readFileSync(QUOTA_FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (obj.date !== todayStr()) return { date: todayStr(), used: 0 }
    return { date: obj.date, used: obj.used || 0 }
  } catch (e) {
    return { date: todayStr(), used: 0 }
  }
}

function writeQuota(q) {
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(q, null, 2))
}

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

async function main() {
  // list one mp4 file
  const files = fs.existsSync(VIDEOS_DIR) ? fs.readdirSync(VIDEOS_DIR).filter(f => f.toLowerCase().endsWith('.mp4')) : []
  if (!files || files.length === 0) {
    console.log('No .mp4 files found in ./videos')
    process.exit(0)
  }

  const file = files[0]
  const filePath = path.join(VIDEOS_DIR, file)
  console.log('Found file to upload:', file)

  // quota check
  const q = readQuota()
  console.log(`Quota used today: ${q.used}/${DAILY_QUOTA} units`)
  if (q.used + UPLOAD_COST > DAILY_QUOTA) {
    console.log(`Quota exceeded or insufficient remaining (need ${UPLOAD_COST} units). Aborting upload.`)
    process.exit(0)
  }

  // setup OAuth2 client
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

  // metadata
  const title = path.basename(file, path.extname(file))
  const description = `Uploaded on ${new Date().toISOString()}`

  try {
    console.log('Starting upload...')

    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus: 'unlisted'
        }
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    }, {
      // set maxContentLength/ maxBodyLength via axios config if needed
    })

    const vid = res?.data?.id
    if (!vid) throw new Error('Upload succeeded but no video id returned')

    console.log(`Upload successful: https://youtu.be/${vid}`)

    // update quota locally
    q.used = (q.used || 0) + UPLOAD_COST
    writeQuota(q)

    // If filename contains Ad ID like <adId>__slug.mp4, update the Ad row in Supabase
    const m = file.match(/^([0-9a-fA-F-]{8,})__/) // basic UUID-ish
    if (m) {
      const adId = m[1]
      const SUPABASE_URL = process.env.SUPABASE_URL
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const patch = await fetch(`${SUPABASE_URL}/rest/v1/Ad?id=eq.${encodeURIComponent(adId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ youtubeUploadedAt: new Date().toISOString(), youtubeVideoId: vid })
          })
          if (!patch.ok) {
            const t = await patch.text().catch(() => '')
            console.warn('Failed to update Ad record', patch.status, t)
          } else {
            console.log('Marked Ad as uploaded', adId)
          }
        } catch (e) {
          console.warn('Error updating Ad metadata', e.message || e)
        }
      }
    }

    // move file to done
    const dest = path.join(DONE_DIR, file)
    fs.renameSync(filePath, dest)
    console.log('Moved file to ./done')

  } catch (err) {
    // if quota error from API, set local used to DAILY_QUOTA to avoid further attempts
    console.error('Upload failed:', err?.message || err)
    if (err && err.errors && err.errors.some(e => e.reason === 'quotaExceeded')) {
      console.log('API indicates quota exceeded; marking local quota as full')
      writeQuota({ date: todayStr(), used: DAILY_QUOTA })
    }
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error', err)
  process.exit(1)
})
