import React from 'react'
import AdCard from '../components/AdLibrary/AdCard'

export default function AdLibraryFavorites() {
  const [ads, setAds] = React.useState<any[]>([])

  React.useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/ad-library/favorites')
      if (res.ok) setAds(await res.json())
    })()
  }, [])

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Saved Ads</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ads.map((a) => (
          <AdCard key={a.id} id={a.id} title={a.title} thumbnail={a.thumbnail} platform={a.platform} onOpen={() => {}} />
        ))}
      </div>
    </div>
  )
}
