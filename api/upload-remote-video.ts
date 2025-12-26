import { google } from 'googleapis'
import fetch from 'node-fetch'
import { PassThrough } from 'stream'

// Use PrismaClient with optional adapter (@prisma/adapter-pg) when available
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient
// Initialize prisma and prefer adapter if available (dynamic import to avoid build-time failures)
;(async () => {
  try {
    const mod = await import('@prisma/adapter-pg')
    const PostgresAdapter = (mod as any).PostgresAdapter
    prisma = new PrismaClient({ adapter: new PostgresAdapter({ url: process.env.DATABASE_URL }) })
  } catch (e) {
    prisma = new PrismaClient()
  }
})()

// Environment configuration
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REFRESH_TOKEN = process.env.REFRESH_TOKEN
const AUTH_TOKEN = process.env.AUTH_TOKEN // used to secure this route

// Generic handler usable in any Node/Express/Serverless framework
export async function uploadRemoteVideoHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Simple auth: require x-auth-token header to match AUTH_TOKEN
  const token = req.headers?.['x-auth-token'] || req.headers?.authorization || null
  if (!AUTH_TOKEN || token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const { url, title } = req.body || {}
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing or invalid `url` in body' })

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return res.status(500).json({ error: 'YouTube client credentials (CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN) are not configured' })
  }

  try {
    // Fetch remote video (stream)
    const remoteRes = await fetch(url)
    if (!remoteRes.ok || !remoteRes.body) {
      return res.status(400).json({ error: `Failed to fetch remote url: ${remoteRes.status}` })
    }

    // Basic content type check (optional)
    const ct = remoteRes.headers.get('content-type') || ''
    if (!/^video\//i.test(ct) && !/application\/octet-stream/i.test(ct)) {
      // allow but warn
      console.warn('Remote content-type is not video/*:', ct)
    }

    // Setup OAuth2 client
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })

    // Stream remote response into PassThrough
    const pass = new PassThrough()
    remoteRes.body.pipe(pass)

    // Upload to YouTube
    const snippet = { title: title || `Uploaded ${new Date().toISOString()}` }

    const uploadRes = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet,
        status: { privacyStatus: 'unlisted' },
      },
      media: {
        body: pass,
      },
    } as any)

    const videoId = uploadRes?.data?.id
    if (!videoId) throw new Error('Upload succeeded but no video id returned')

    const youtubeUrl = `https://youtu.be/${videoId}`

    // Persist to Prisma: insert Video record
    await prisma.video.create({ data: {
      title: snippet.title,
      youtubeUrl,
      status: 'UPLOADED',
      remoteUrl: url,
      uploadedAt: new Date(),
    }})

    return res.status(200).json({ ok: true, youtubeUrl })
  } catch (err) {
    console.error('upload-remote-video error', err)
    // record failed attempt in DB
    try {
      await prisma.video.create({ data: {
        title: title || null,
        youtubeUrl: null,
        status: 'FAILED',
        remoteUrl: url,
      }})
    } catch (e) {
      console.warn('failed to write failure record', e)
    }

    return res.status(500).json({ error: (err as any)?.message || String(err) })
  }
}

// If using Vercel/Next, export default handler wrapper
export default function defaultHandler(req: any, res: any) {
  return uploadRemoteVideoHandler(req, res)
}
