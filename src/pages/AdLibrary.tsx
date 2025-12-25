import React from 'react'
import AdCard from '../components/AdLibrary/AdCard'
import Filters from '../components/AdLibrary/Filters'
import VideoPlayer from '../components/AdLibrary/VideoPlayer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type AdSummary = {
  id: string
  title: string
  thumbnail?: string
  platform?: string
  durationSec?: number
}

export default function AdLibraryPage() {
  const [ads, setAds] = React.useState<AdSummary[]>([])
  const [filters, setFilters] = React.useState({} as any)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchAds()
  }, [filters])

  async function fetchAds() {
    // Try serverless function first, fallback to client-side YouTube API call using VITE_YOUTUBE_API_KEY
    const q = new URLSearchParams(filters)
    let res = await fetch(`/supabase/functions/v1/youtube-search?${q.toString()}`).catch(() => null)
    if (!res || !res.ok) {
      const key = import.meta.env.VITE_YOUTUBE_API_KEY
      if (!key) return
      const apiUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      apiUrl.searchParams.set('key', key)
      apiUrl.searchParams.set('part', 'snippet')
      apiUrl.searchParams.set('q', (filters.industry || 'ad') as string)
      apiUrl.searchParams.set('maxResults', '24')
      apiUrl.searchParams.set('type', 'video')
      res = await fetch(apiUrl.toString())
      if (!res.ok) return
      const data = await res.json()
      const items = (data.items || []).map((it: any) => ({ id: it.id.videoId, title: it.snippet.title, thumbnail: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url, platform: 'YOUTUBE', durationSec: undefined }))
      setAds(items)
      return
    }
    const data = await res.json()
    setAds(data.items || [])
  }

  async function openAd(id: string) {
    setSelected(id)
    const res = await fetch(`/api/ad-library/${id}`)
    if (res.ok) {
      const data = await res.json()
      setPreviewSrc(data.sourceUrl)
    }
  }

  const [addUrl, setAddUrl] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [addResult, setAddResult] = React.useState<string | null>(null)

  async function submitUrl() {
    if (!addUrl) return
    setAdding(true)
    setAddResult(null)
    try {
      // call Supabase Edge Function `add-ad` (deployed)
      const res = await fetch('/supabase/functions/v1/add-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text)
      setAddResult('Added successfully')
      setAddUrl('')
      // refresh ads list after a short delay to allow DB propagation
      setTimeout(fetchAds, 1000)
    } catch (err) {
      setAddResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-72">
          <Filters value={filters} onChange={setFilters} />
          <div className="mt-4 p-3 bg-white rounded shadow">
            <h4 className="text-sm font-semibold mb-2">Add your ad by URL</h4>
            <div className="flex gap-2">
              <Input placeholder="https://..." value={addUrl} onChange={(e) => setAddUrl((e.target as HTMLInputElement).value)} />
              <Button onClick={submitUrl} disabled={adding}>{adding ? 'Adding...' : 'Add'}</Button>
            </div>
            {addResult && <div className="mt-2 text-sm">{addResult}</div>}
            <div className="mt-2 text-xs text-muted-foreground">By submitting you confirm you have ownership or permission to use this video. Ads are auto-published.</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ads.map((a) => (
              <AdCard key={a.id} {...a} onOpen={openAd} />
            ))}
          </div>
        </div>
        <div className="w-96">
          {previewSrc ? <VideoPlayer src={previewSrc} /> : <div className="p-4 bg-white rounded shadow">Select an ad to preview</div>}
        </div>
      </div>

      {/* TODO: Add pagination, sorting, and AI remix hooks for derivative ads */}
    </div>
  )
}
