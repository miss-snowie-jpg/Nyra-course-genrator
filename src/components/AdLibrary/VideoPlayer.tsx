import React from 'react'
import { supabase } from '../../integrations/supabase/client'

type Props = {
  src: string
  filename?: string
}

export const VideoPlayer: React.FC<Props> = ({ src, filename }) => {
  const [isPaid, setIsPaid] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    // Preferably fetch billing info from server; simplified here using supabase session metadata
    async function check() {
      const { data } = await supabase.auth.getSession()
      // TODO: replace with server-side paid check; for now assume logged-in users are paid
      setIsPaid(!!data.session)
    }
    check()
  }, [])

  const handleDownloadClick = (e: React.MouseEvent) => {
    if (!isPaid) {
      e.preventDefault()
      // show a concise message; use native alert for shortness
      alert('Sign in to download')
    }
  }

  return (
    <div className="bg-black rounded">
      <video controls src={src} className="w-full h-auto" />
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
