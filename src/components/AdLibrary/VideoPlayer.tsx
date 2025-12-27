import React from 'react'
import { supabase } from '../../integrations/supabase/client'

type Props = {
  src: string
  filename?: string
}

export const VideoPlayer: React.FC<Props> = ({ src, filename }) => {
  const [isPaid, setIsPaid] = React.useState<boolean | null>(null)
  const [embedHtml, setEmbedHtml] = React.useState<string | null>(null)
  const [embedError, setEmbedError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Preferably fetch billing info from server; simplified here using supabase session metadata
    async function check() {
      const { data } = await supabase.auth.getSession()
      // TODO: replace with server-side paid check; for now assume logged-in users are paid
      setIsPaid(!!data.session)
    }
    check()
  }, [])

  // If src is not a direct media file (mp4, webm), attempt oEmbed (noembed.com) for Instagram/TikTok/etc.
  React.useEffect(() => {
    async function tryEmbed() {
      if (!src) return
      const lower = src.toLowerCase()
      const looksLikeMedia = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.startsWith('blob:')
      if (looksLikeMedia) return

      // Use noembed as a quick fallback; it supports many providers like Instagram and TikTok
      try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(src)}`)
        if (!res.ok) throw new Error('noembed failed')
        const j = await res.json()
        if (j && j.html) {
          setEmbedHtml(j.html)
          setEmbedError(null)
        } else {
          setEmbedHtml(null)
          setEmbedError('No embed available')
        }
      } catch (err) {
        setEmbedHtml(null)
        setEmbedError('Preview unavailable for this source')
      }
    }
    tryEmbed()
  }, [src])

  const handleDownloadClick = (e: React.MouseEvent) => {
    if (!isPaid) {
      e.preventDefault()
      // show a concise message; use native alert for shortness
      alert('Sign in to download')
    }
  }

  return (
    <div className="bg-black rounded p-2">
      {embedHtml ? (
        // Render provider HTML (e.g., Instagram embed). This may include <blockquote> markup and script tags.
        <div className="w-full" dangerouslySetInnerHTML={{ __html: embedHtml }} />
      ) : (
        <video controls src={src || undefined} className="w-full h-auto" />
      )}

      {embedError && <div className="text-sm text-muted-foreground mt-2">{embedError}</div>}

      <div className="p-2 flex justify-end gap-2">
        {isPaid ? (
          <a href={src} download={filename || ''} target="_blank" rel="noopener noreferrer" onClick={handleDownloadClick} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded">Download</a>
        ) : (
          <button onClick={() => alert('Sign in to download')} className="text-sm text-gray-400">Sign in</button>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer
