#!/usr/bin/env node
/*
Bulk upload MP4s from a local folder to Supabase Storage and create Ad rows.

Usage:
  SUPABASE_URL="https://<project>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" node scripts/bulk-upload-mp4s.js --dir ./videos [--bucket ads] [--trim] [--skip-long]

Options:
  --dir      Path to local folder with .mp4 files (default: ./videos)
  --bucket   Supabase storage bucket to upload to (default: ads)
  --trim     If provided, ffmpeg will trim files longer than 10s down to 10s (requires ffmpeg on PATH)
  --skip-long If provided, files longer than 10s will be skipped

Notes:
  - Requires Node 18+ (for global fetch). If you want trimming or duration checks, ffmpeg/ffprobe must be available on PATH.
  - The script expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in the environment.
*/

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

async function main() {
  const args = process.argv.slice(2)
  const dir = (() => {
    const i = args.indexOf('--dir')
    if (i !== -1 && args[i + 1]) return args[i + 1]
    return './videos'
  })()
  const bucket = (() => {
    const i = args.indexOf('--bucket')
    if (i !== -1 && args[i + 1]) return args[i + 1]
    return 'ads'
  })()
  const trim = args.includes('--trim')
  const skipLong = args.includes('--skip-long')

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }

  // Dynamic import to avoid CJS/ESM issues in different environments
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) {
    console.error('Directory not found:', dir)
    process.exit(1)
  }

  const files = fs.readdirSync(dir).filter(f => /\.mp4$/i.test(f))
  if (files.length === 0) {
    console.log('No MP4 files found in', dir)
    return
  }

  for (const file of files) {
    const fullPath = path.resolve(dir, file)
    console.log('---')
    console.log('Processing', file)

    // Probe duration with ffprobe if available
    let duration = null
    try {
      const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', fullPath], { encoding: 'utf8' })
      if (p.status === 0 && p.stdout) {
        duration = Math.round(Number(p.stdout.trim()))
        console.log('Duration (s):', duration)
      }
    } catch (e) {
      console.log('ffprobe not available or failed, continuing without duration check')
    }

    let toUploadPath
    let uploadStreamPath = fullPath
    let tmpTrimPath = null

    if (duration && duration > 10) {
      if (trim) {
        console.log('Trimming to 10s (requires ffmpeg)')
        tmpTrimPath = path.join(os.tmpdir(), `trimmed-${Date.now()}-${file}`)
        const r = spawnSync('ffmpeg', ['-y', '-i', fullPath, '-ss', '0', '-t', '10', '-c', 'copy', tmpTrimPath], { stdio: 'inherit' })
        if (r.status !== 0) {
          console.error('ffmpeg trim failed for', file)
          if (fs.existsSync(tmpTrimPath)) fs.unlinkSync(tmpTrimPath)
          continue
        }
        uploadStreamPath = tmpTrimPath
        duration = 10
      } else if (skipLong) {
        console.log('Skipping file >10s:', file)
        continue
      } else {
        console.log('File longer than 10s; use --trim to trim or --skip-long to skip. Skipping by default.')
        continue
      }
    }

    const uploadName = `processed/${Date.now()}-${file}`

    try {
      const stream = fs.createReadStream(uploadStreamPath)
      const up = await supabase.storage.from(bucket).upload(uploadName, stream)
      if (up.error) throw up.error

      const { data: pu } = supabase.storage.from(bucket).getPublicUrl(uploadName)
      const publicUrl = pu?.publicUrl
      if (!publicUrl) throw new Error('Failed to obtain public URL')

      // Create Ad row via Supabase (server role key used)
      const adRow = {
        title: file,
        description: '',
        platform: 'META', // generic default for user uploads
        industry: null,
        hookType: null,
        ctaType: null,
        sourceUrl: publicUrl,
        sourceType: 'USER_UPLOAD',
        originalOwner: null,
        published: true,
        thumbnail: null,
        durationSec: duration || null,
      }

      const insert = await supabase.from('Ad').insert([adRow])
      if (insert.error) throw insert.error
      console.log('Uploaded & created Ad for', file)
    } catch (err) {
      console.error('Failed to upload/create ad for', file, err)
    } finally {
      if (tmpTrimPath && fs.existsSync(tmpTrimPath)) fs.unlinkSync(tmpTrimPath)
    }

    // slight delay between uploads
    await new Promise(r => setTimeout(r, 700))
  }

  console.log('Done')
}

main().catch(err => { console.error('Fatal error', err); process.exit(1) })
