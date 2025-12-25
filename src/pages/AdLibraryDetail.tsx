import React from 'react'
import VideoPlayer from '../components/AdLibrary/VideoPlayer'

export default function AdLibraryDetail({ id }: { id?: string }) {
  const [ad, setAd] = React.useState<any | null>(null)

  React.useEffect(() => {
    if (!id) return
    ;(async () => {
      const res = await fetch(`/api/ad-library/${id}`)
      if (res.ok) setAd(await res.json())
    })()
  }, [id])

  if (!ad) return <div className="p-4">Loading...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ad.title}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <VideoPlayer src={ad.sourceUrl} />
        </div>
        <div className="p-4 bg-white rounded shadow">
          <p className="text-sm text-gray-600">{ad.description}</p>
          <ul className="mt-3 text-sm space-y-1">
            <li><strong>Platform:</strong> {ad.platform}</li>
            <li><strong>Industry:</strong> {ad.industry}</li>
            <li><strong>Hook:</strong> {ad.hookType}</li>
            <li><strong>CTA:</strong> {ad.ctaType}</li>
          </ul>
        </div>
      </div>

      {/* TODO: Add AI remix panel to generate derivative creatives */}
    </div>
  )
}
