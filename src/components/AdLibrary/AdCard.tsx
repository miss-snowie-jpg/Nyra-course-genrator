import React from 'react'
import { supabase } from '../../integrations/supabase/client'

type Props = {
  id: string
  title: string
  thumbnail?: string
  platform?: string
  durationSec?: number
  onOpen: (id: string) => void
}

export const AdCard: React.FC<Props> = ({ id, title, thumbnail, platform, durationSec, onOpen }) => {
  const [saving, setSaving] = React.useState(false)

  async function toggleSave() {
    setSaving(true)
    try {
      const user = supabase.auth.getUser().then(r => r.data.user)
      // Persist to Supabase table `UserSavedAds` (assumes table exists). This is a lightweight
      // favorite-saving path that uses the existing Supabase integration. For a Prisma-backed
      // server, replace this with a secure server endpoint that writes to Postgres/Prisma.
      await supabase.from('UserSavedAds').insert([{ adId: id }])
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save favorite', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md overflow-hidden">
      <div className="relative cursor-pointer" onClick={() => onOpen(id)}>
        <img src={thumbnail || '/placeholder-thumb.png'} alt={title} className="w-full h-48 object-cover" />
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{platform}</div>
        {durationSec ? (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{Math.round(durationSec)}s</div>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <div className="mt-2 flex items-center justify-between">
          <button onClick={toggleSave} disabled={saving} className="text-sm text-indigo-600">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => onOpen(id)} className="text-sm text-gray-600">Preview</button>
        </div>
      </div>
    </div>
  )
}

export default AdCard
