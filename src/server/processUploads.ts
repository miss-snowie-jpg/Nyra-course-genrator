#!/usr/bin/env node
/*
Worker to process uploaded short videos:
- Polls `AdUpload` table for unprocessed uploads
- Downloads the raw file from Supabase storage (signed URL)
- Uses ffmpeg/ffprobe to get duration, transcode to MP4 H.264, and generate a thumbnail
- Uploads processed video and thumbnail to storage (`ads` bucket) and creates an `Ad` record via Supabase REST

Requirements:
- Node 18+
- ffmpeg installed and on PATH (ffmpeg and ffprobe)
- Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Install dependencies:
  npm install node-fetch @supabase/supabase-js fluent-ffmpeg fs-extra
  npm i -D @types/node

Run:
  node ./dist/server/processUploads.js
*/

import fs from 'fs'
import os from 'os'
import path from 'path'
// Use global fetch (Node 18+). Use fluent-ffmpeg for processing (requires ffmpeg installed)
// @ts-expect-error: fluent-ffmpeg may not have types in this environment
import ffmpeg from 'fluent-ffmpeg'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

type AdUploadRow = {
  id: string
  storagePath: string
  filename?: string
  size?: number
  userId?: string | null
  durationSec?: number | null
  processed?: boolean
}

async function pollOnce() {
  // Use Supabase REST to fetch unprocessed uploads to avoid client typing issues
  const q = `${SUPABASE_URL}/rest/v1/AdUpload?processed=eq.false&order=createdAt.asc&limit=5`
  const r = await fetch(q, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`Failed to query AdUpload: ${r.status} ${txt}`)
  }
  const uploads = (await r.json()) as AdUploadRow[]
  if (!uploads || uploads.length === 0) return

  for (const u of uploads) {    console.log('Processing upload', u.id, u.storagePath)
    try {
      const bucket = 'ads-raw'
      // Create signed url to download
      const { data: signed, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(u.storagePath, 60)
      if (sErr || !signed) throw sErr || new Error('Failed to create signed URL')
      const url = signed.signedUrl

      // Download to tmp file
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-upload-'))
      const rawPath = path.join(tmpDir, path.basename(u.storagePath))
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to download raw file')
      const buffer = Buffer.from(await res.arrayBuffer())
      fs.writeFileSync(rawPath, buffer)

      // get duration using ffprobe via fluent-ffmpeg
      const duration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(rawPath, (err, meta) => {
          if (err) return reject(err)
          const d = meta?.format?.duration || 0
          resolve(Math.round(d))
        })
      })

      if (!duration || duration > 10) {
        // mark upload as error
        await supabase.from('AdUpload').update({ processed: false, error: 'Duration exceeds 10s', processedAt: new Date().toISOString() }).eq('id', u.id)
        console.log('Skipping: duration >10s', duration)
        fs.rmSync(tmpDir, { recursive: true, force: true })
        continue
      }

      // Transcode to mp4 h264 and create thumbnail
      const processedName = `processed-${Date.now()}-${path.basename(u.storagePath, path.extname(u.storagePath))}.mp4`
      const thumbName = `thumb-${Date.now()}-${path.basename(u.storagePath, path.extname(u.storagePath))}.jpg`
      const processedPath = path.join(tmpDir, processedName)
      const thumbPath = path.join(tmpDir, thumbName)

      await new Promise<void>((resolve, reject) => {
        ffmpeg(rawPath)
          .outputOptions(['-c:v libx264', '-preset veryfast', '-crf 23', '-c:a aac', '-movflags +faststart'])
          .duration(10)
          .size('?x720')
          .save(processedPath)
          .on('end', () => resolve())
          .on('error', (e) => reject(e))
      })

      // thumbnail at 1s
      await new Promise<void>((resolve, reject) => {
        ffmpeg(processedPath)
          .screenshots({ timestamps: ['00:00:01.000'], filename: path.basename(thumbPath), folder: tmpDir, size: '640x?' })
          .on('end', () => resolve())
          .on('error', (e) => reject(e))
      })

      // Upload processed assets
      const processedBucket = 'ads'
      const thumbBucket = 'ads-thumbs'

      const processedUpload = await supabase.storage.from(processedBucket).upload(`processed/${processedName}`, fs.createReadStream(processedPath))
      if (processedUpload.error) throw processedUpload.error
      const thumbUpload = await supabase.storage.from(thumbBucket).upload(`thumbs/${thumbName}`, fs.createReadStream(thumbPath))
      if (thumbUpload.error) throw thumbUpload.error

      const { data: procUrlData } = supabase.storage.from(processedBucket).getPublicUrl(`processed/${processedName}`)
      const { data: thumbUrlData } = supabase.storage.from(thumbBucket).getPublicUrl(`thumbs/${thumbName}`)
      const videoUrl = procUrlData?.publicUrl
      const thumbUrl = thumbUrlData?.publicUrl

      if (!videoUrl) throw new Error('Failed to obtain processed public URL')

      // Create Ad record
      const adRow = {
        title: u.filename || `Uploaded ad ${Date.now()}`,
        description: '',
        platform: 'USER_UPLOAD',
        industry: null,
        hookType: null,
        ctaType: null,
        sourceUrl: videoUrl,
        sourceType: 'USER_UPLOAD',
        originalOwner: u.userId || null,
        published: true,
        thumbnail: thumbUrl || null,
        durationSec: duration,
        createdAt: new Date().toISOString(),
      }

      const insertRes = await supabase.from('Ad').insert([adRow])
      if (insertRes.error) throw insertRes.error

      // mark upload processed
      await supabase.from('AdUpload').update({ processed: true, durationSec: duration, processedAt: new Date().toISOString() }).eq('id', u.id)

      // cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true })
      console.log('Processed upload', u.id)
    } catch (err) {
      console.error('Error processing upload', u.id, err)
      try {
        await supabase.from('AdUpload').update({ error: err instanceof Error ? err.message : String(err), processedAt: new Date().toISOString() }).eq('id', u.id)
      } catch (e) {
        console.error('Failed to update upload error', e)
      }
    }
  }
}

async function main() {
  console.log('Starting upload processor')
  while (true) {
    try {
      await pollOnce()
    } catch (err) {
      console.error('Processor error', err)
    }
    // sleep 10s between polls
    await new Promise((r) => setTimeout(r, 10000))
  }
}

if (require.main === module) {
  main()
}
