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
  const [previewTitle, setPreviewTitle] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchAds()
  }, [filters])


  React.useEffect(() => {
    fetchAds()
  }, [filters])

  async function fetchAds() {
    const q = new URLSearchParams(filters)
    const res = await fetch(`/supabase/functions/v1/video-search?${q.toString()}`).catch(() => null)
    if (!res || !res.ok) {
      // If no function deployed, fallback to empty list (we rely on internal Ad Library)
      setAds([])
      return
    }
    const data = await res.json()
    setAds(data.items || [])
  }

  async function openAd(id: string) {
    setSelected(id)
    // Prefer the Edge function to fetch ad metadata
    const res = await fetch(`/supabase/functions/v1/get-ad?id=${encodeURIComponent(id)}`)
    if (res.ok) {
      const data = await res.json()
      const ad = data.ad
      setPreviewSrc(ad?.sourceUrl || ad?.source_url || null)
      setPreviewTitle(ad?.title || null)
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
          {previewSrc ? <VideoPlayer src={previewSrc} filename={previewTitle ?? undefined} /> : <div className="p-4 bg-white rounded shadow">Select an ad to preview</div>}
        </div>
      </div>

      {/* TODO: Add pagination, sorting, and AI remix hooks for derivative ads */}
    </div>
  )
}
