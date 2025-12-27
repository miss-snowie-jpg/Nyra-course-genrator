import React, { useEffect, useState } from 'react'

// Lightweight VideoEditor using FFmpeg.wasm (@ffmpeg/ffmpeg) in the browser
// Features (minimal MVP): trim start/end, text overlay (headline + CTA), change aspect ratio, export MP4 for download

type Props = {
  src: string // public internet URL to the video
  onClose: () => void
  onExported?: (blob: Blob) => void
}

// Minimal typing for the FFmpeg wasm instance used in-browser
type FFmpegInstance = {
  load: () => Promise<void>
  run: (...args: string[]) => Promise<void>
  FS: (cmd: string, ...args: unknown[]) => unknown
}

type FFmpegWindow = {
  __ffmpeg?: FFmpegInstance
  __ffmpeg_fetchFile?: (src: unknown) => Uint8Array
}

const VideoEditor: React.FC<Props> = ({ src, onClose, onExported }) => {
  const [loading, setLoading] = useState(false)
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const [start, setStart] = useState<number>(0)
  const [end, setEnd] = useState<number | null>(null)
  const [headline, setHeadline] = useState<string>('')
  const [cta, setCta] = useState<string>('')
  const [ratio, setRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16')
  const [duration, setDuration] = useState<number | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  // Keep a ref to the video element for quick metadata
  useEffect(() => {
    // Try to probe duration via a hidden video element
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.src = src
    v.onloadedmetadata = () => {
      setDuration(v.duration || null)
      v.remove()
    }
    v.onerror = () => { v.remove() }
  }, [src])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        // Dynamic import of ffmpeg (browser build). This keeps the app fast until editor is needed.
        const ffmpegMod = await import('@ffmpeg/ffmpeg')
        const { createFFmpeg, fetchFile } = ffmpegMod as unknown as { createFFmpeg: (opts: { log?: boolean; progress?: (p: { ratio: number }) => void }) => FFmpegInstance; fetchFile: (src: unknown) => Uint8Array }
        const ff = createFFmpeg({ log: true, progress: ({ ratio }: { ratio: number }) => { setProgress(`${Math.round((ratio || 0) * 100)}%`) } })
        await ff.load()
        if (cancelled) return
        // store ff and fetchFile on window for simple reuse (MVP)
        ;(window as unknown as FFmpegWindow).__ffmpeg = ff
        ;(window as unknown as FFmpegWindow).__ffmpeg_fetchFile = fetchFile
        setFfmpegLoaded(true)
      } catch (err) {
        console.error('Failed to load ffmpeg.wasm, editor will be unavailable', err)
        setFfmpegLoaded(false)
      } finally { setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function exportVideo() {
    if (!(window as unknown as FFmpegWindow).__ffmpeg) {
      alert('FFmpeg not available in this browser or failed to load. Please try again later.')
      return
    }

    try {
      setLoading(true)
      const ff = (window as unknown as FFmpegWindow).__ffmpeg as FFmpegInstance
      const fetchFile = (window as unknown as FFmpegWindow).__ffmpeg_fetchFile as (src: unknown) => Uint8Array

      // Fetch remote video into memory
      setProgress('Downloading source...')
      const res = await fetch(src)
      if (!res.ok) throw new Error('Failed to download source video')
      const ab = await res.arrayBuffer()
      const inputName = 'input.mp4'
      ff.FS('writeFile', inputName, await fetchFile(new Uint8Array(ab)))

      // compute trimming args
      const ss = Math.max(0, Number(start) || 0)
      const to = end && end > ss ? Number(end) : null

      // aspect ratio handling: scale and pad to chosen ratio (MVP)
      // 9:16 -> 540x960, 1:1 -> 720x720, 16:9 -> 1280x720
      const target = ratio === '9:16' ? '540:960' : ratio === '1:1' ? '720:720' : '1280:720'

      // Build ffmpeg args
      const outName = 'out.mp4'
      const vfParts: string[] = []

      // scale preserving aspect and pad/crop to target
      vfParts.push(`scale=${target.split(':')[0]}:${target.split(':')[1]}:force_original_aspect_ratio=decrease`)
      vfParts.push(`pad=${target}:(${target.split(':')[0]}-iw)/2:(${target.split(':')[1]}-ih)/2:black`)

      // text overlay using drawtext (may not work in all ffmpeg builds; if it fails, ignore text overlay)
      if (headline || cta) {
        // place headline at top, CTA at bottom
        const fontColor = 'white'
        const fontSize = 24
        if (headline) vfParts.push(`drawtext=text='${escapeFilterText(headline)}':fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=20`)
        if (cta) vfParts.push(`drawtext=text='${escapeFilterText(cta)}':fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=h-text_h-20`)
      }

      const vf = vfParts.join(',')

      const args: string[] = ['-i', inputName]
      if (ss) { args.push('-ss', String(ss)) }
      if (to) { args.push('-to', String(to)) }
      args.push('-vf', vf)
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', outName)

      setProgress('Processing...')
      await ff.run(...args)

      setProgress('Exporting...')
      const data = ff.FS('readFile', outName) as Uint8Array
      const arrbuf = (data.buffer as unknown as ArrayBuffer)
      const blob = new Blob([arrbuf], { type: 'video/mp4' })

      // Offer download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ad-export-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setProgress(null)
      if (onExported) onExported(blob)
      alert('Export finished — file should download automatically')
    } catch (err) {
      console.error('Export failed', err)
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white p-6 rounded max-w-3xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Video Editor</h3>
          <div className="flex gap-2">
            <button className="text-sm text-gray-600" onClick={onClose}>Close</button>
            <button className="text-sm text-primary" onClick={exportVideo} disabled={loading || !ffmpegLoaded || !src}>{loading ? 'Processing...' : 'Export'}</button>
          </div>
        </div>

        {!ffmpegLoaded && <div className="mb-4 text-sm text-muted-foreground">Editor is loading (FFmpeg.wasm). Large files may take time.</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Start (seconds)</label>
            <input className="w-full border rounded p-2" type="number" min={0} value={start} onChange={(e) => setStart(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End (seconds)</label>
            <input className="w-full border rounded p-2" type="number" min={0} value={end ?? ''} onChange={(e) => setEnd(e.target.value ? Number(e.target.value) : null)} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Headline (overlay)</label>
            <input className="w-full border rounded p-2" type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">CTA (overlay)</label>
            <input className="w-full border rounded p-2" type="text" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Aspect Ratio</label>
            <select className="w-full border rounded p-2" value={ratio} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRatio(e.target.value as '9:16' | '1:1' | '16:9')}>
              <option value="9:16">9:16 (Vertical)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="16:9">16:9 (Landscape)</option>
            </select>
          </div>

          <div className="col-span-2 mt-2">
            <div className="mb-2">Preview</div>
            <video src={src} controls className="w-full rounded" />
          </div>
        </div>

        {progress && <div className="mt-4 text-sm">{progress}</div>}
      </div>
    </div>
  )
}

function escapeFilterText(t: string) {
  // Minimal escaping for ffmpeg drawtext; this may need improvement for complex input
  return t.replace(/:/g, '\\:').replace(/'/g, "\\'")
}

export default VideoEditor
