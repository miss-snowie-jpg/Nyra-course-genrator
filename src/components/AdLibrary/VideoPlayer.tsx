import React from 'react'
import { supabase } from '../../integrations/supabase/client'

type Props = {
  src: string
  canDownload?: boolean
}

export const VideoPlayer: React.FC<Props> = ({ src, canDownload }) => {
  const [isPaid, setIsPaid] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    // Preferably fetch billing info from server; simplified here using supabase session metadata
    async function check() {
      const { data } = await supabase.auth.getSession()
      // TODO: call backend to determine paid access; for now assume logged-in users are paid
      setIsPaid(!!data.session)
    }
    check()
  }, [])

  return (
    <div className="bg-black rounded">
      <video controls src={src} className="w-full h-auto" />
      <div className="p-2 flex justify-end gap-2">
        {isPaid ? (
          <a href={src} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded">Download</a>
        ) : (
          <div className="text-sm text-gray-400">Sign up to download</div>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer
