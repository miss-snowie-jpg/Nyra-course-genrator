import React from 'react'
import { supabase } from '../../integrations/supabase/client'

type Props = {
  src: string
  adId?: string
  filename?: string
}

export const VideoPlayer: React.FC<Props> = ({ src, adId, filename }) => {
  const [isPaid, setIsPaid] = React.useState<boolean | null>(null)
  const [embedHtml, setEmbedHtml] = React.useState<string | null>(null)
  const [embedError, setEmbedError] = React.useState<string | null>(null)
  const [videoSrc, setVideoSrc] = React.useState<string | null>(null)
  const [processing, setProcessing] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Preferably fetch billing info from server; simplified here using supabase session metadata
    async function check() {
      const { data } = await supabase.auth.getSession()
      // TODO: replace with server-side paid check; for now assume logged-in users are paid
      setIsPaid(!!data.session)
    }
    check()
  }, [])

  // If src is not a direct media file (mp4, webm), attempt server preview, else oEmbed fallback
  React.useEffect(() => {
    let active = true
    let objUrl: string | null = null

    async function fetchPreviewViaServer() {
      if (!src || !adId) return
      const lower = src.toLowerCase()
      const looksLikeMedia = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.startsWith('blob:')
      if (looksLikeMedia) { setVideoSrc(src); return }

      // Try server preview endpoint
      try {
        const res = await fetch(`/supabase/functions/v1/download-ad?id=${encodeURIComponent(adId)}&mode=preview`)
        if (res.status === 202) {
          // queued for processing; poll get-ad every 2s up to 10 times
          setProcessing('queued')
          for (let i = 0; i < 10 && active; i++) {
            await new Promise(r => setTimeout(r, 2000))
            const gad = await fetch(`/supabase/functions/v1/get-ad?id=${encodeURIComponent(adId)}`)
            if (!gad.ok) continue
            const j = await gad.json()
            const ad = j.ad
            const newSrc = ad?.sourceUrl || ad?.source_url
            if (newSrc && (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(newSrc) || newSrc.includes('/storage/v1/object/public/'))) {
              setProcessing(null)
              setVideoSrc(newSrc)
              break
            }
            // show thumbnail fallback while processing if available
            if (ad?.thumbnail && !newSrc) {
              setEmbedHtml(`<img src="${encodeURI(ad.thumbnail)}" alt="${(ad.title || 'preview').replace(/"/g,'')}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`)
            }
          }

          setProcessing(null)
          if (active && !videoSrc) setEmbedError('Preview will be available once processing completes.')
          return
        }

        if (!res.ok) throw new Error('Preview fetch failed')
        const ct = res.headers.get('content-type') || ''
        if (ct.startsWith('video/')) {
          const blob = await res.blob()
          objUrl = URL.createObjectURL(blob)
          if (!active) return
          setVideoSrc(objUrl)
          setEmbedError(null)
          setEmbedHtml(null)
          return
        }

        // fallback to oEmbed
      } catch (err) {
        console.warn('Server preview failed', err)
      }

      // Try noembed fallback
      try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(src)}`)
        if (!res.ok) throw new Error('noembed failed')
        const j = await res.json()
        if (j && j.html) {
          // sanitize embed HTML (strip scripts and use DOMPurify if available in the browser)
          try {
            let cleanHtml = j.html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            if (typeof window !== 'undefined') {
              const DOMPurify = (await import('dompurify')).default
              cleanHtml = DOMPurify.sanitize(cleanHtml, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] })
            }
            setEmbedHtml(cleanHtml)
            setEmbedError(null)
          } catch (e) {
            setEmbedHtml(null)
            setEmbedError('Embed content not safe')
          }
        } else {
          setEmbedHtml(null)
          setEmbedError('No embed available')
        }
      } catch (err) {
        setEmbedHtml(null)
        setEmbedError('Preview unavailable for this source')
      }
    }

    // Reset state
    setVideoSrc(null)
    setEmbedHtml(null)
    setEmbedError(null)
    setProcessing(null)

    fetchPreviewViaServer()

    return () => { active = false; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [src, adId, videoSrc])

  const handleDownloadClick = (e: React.MouseEvent) => {
    if (!isPaid) {
      e.preventDefault()
      // show a concise message; use native alert for shortness
      alert('Sign in to download')
    }
  }

  const downloadHref = adId ? `/supabase/functions/v1/download-ad?id=${encodeURIComponent(adId)}` : src

  return (
    <div className="bg-black rounded p-2">
      {videoSrc ? (
        <video controls src={videoSrc} className="w-full h-auto" />
      ) : embedHtml ? (
        <div className="w-full" dangerouslySetInnerHTML={{ __html: embedHtml }} />
      ) : (
        <div className="p-6 text-sm text-white text-center">{processing || 'Loading preview...'}</div>
      )}

      {embedError && <div className="text-sm text-muted-foreground mt-2">{embedError}</div>}

      {/* If preview/embed not available, offer a direct "Open source" link so the user can view the source page */}
      {!videoSrc && !embedHtml && src && (
        <div className="mt-2 text-right">
          <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open source</a>
        </div>
      )}

      <div className="p-2 flex justify-end gap-2">
        {isPaid ? (
          <a href={downloadHref} download={filename || ''} target="_blank" rel="noopener noreferrer" onClick={handleDownloadClick} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded">Download</a>
        ) : (
          <button onClick={() => alert('Sign in to download')} className="text-sm text-gray-400">Sign in</button>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer
