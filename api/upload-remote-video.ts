import { PrismaClient } from '@prisma/client'

// This endpoint no longer uploads to YouTube.
// It enqueues a remote URL as an AdUpload (remote=true) so the existing
// `processUploads` worker can download, validate (<=10s), transcode, and create an Ad.

const prisma = new PrismaClient()

// Generic handler usable in Node/Express/Serverless environments
export async function uploadRemoteVideoHandler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers?.['x-auth-token'] || req.headers?.authorization || null
  if (!process.env.AUTH_TOKEN || token !== process.env.AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' })

  const { url, filename, userId } = req.body || {}
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing or invalid `url` in body' })

  try {
    // Basic URL validation
    let parsed: URL
    try { parsed = new URL(url) } catch (e) { return res.status(400).json({ error: 'Invalid URL' }) }

    const defaultFilename = filename || parsed.pathname.split('/').filter(Boolean).pop() || null

    const created = await prisma.adUpload.create({ data: {
      storagePath: url,
      filename: defaultFilename,
      remote: true,
      processed: false,
      userId: userId || null,
    }})

    return res.status(200).json({ ok: true, uploadId: created.id })
  } catch (err) {
    console.error('enqueue remote url error', err)
    return res.status(500).json({ error: (err as any)?.message || String(err) })
  }
}

// Default export for frameworks that expect it
export default function defaultHandler(req: any, res: any) { return uploadRemoteVideoHandler(req, res) }
