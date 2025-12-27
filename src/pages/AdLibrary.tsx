import React from 'react'
import AdCard from '../components/AdLibrary/AdCard'
import Filters from '../components/AdLibrary/Filters'
import VideoPlayer from '../components/AdLibrary/VideoPlayer'
import VideoEditor from '../components/AdLibrary/VideoEditor'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'

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

  // Editor state
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorAdId, setEditorAdId] = React.useState<string | null>(null)
  const [editorSrc, setEditorSrc] = React.useState<string | null>(null)

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

  async function openEditor(id: string) {
    // Verify paid status server-side
    try {
      const r = await fetch('/supabase/functions/v1/verify-paid', { method: 'POST' })
      if (r.status === 402) {
        alert('Publishing and editing require a paid plan. Visit Checkout to upgrade.')
        return
      }
      if (!r.ok) throw new Error('Failed to verify billing')
      // Fetch ad metadata and open editor
      const res = await fetch(`/supabase/functions/v1/get-ad?id=${encodeURIComponent(id)}`)
      if (res.ok) {
        const data = await res.json()
        const ad = data.ad
        setEditorAdId(id)
        setEditorSrc(ad?.sourceUrl || ad?.source_url || null)
        setEditorOpen(true)
      } else {
        alert('Failed to fetch ad metadata')
      }
    } catch (err) {
      console.error('verify paid or open editor failed', err)
      alert('Failed to open editor')
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

          <div className="mt-4 p-3 bg-white rounded shadow">
            <h4 className="text-sm font-semibold mb-2">Upload short video (≤10s)</h4>
            <UploadShortVideo />
            <div className="mt-2 text-xs text-muted-foreground">Files are uploaded to the project's storage bucket `ads`. Ensure the bucket exists. Uploads auto-publish as user uploads.</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ads.map((a) => (
              <AdCard key={a.id} {...a} onOpen={openAd} onEdit={openEditor} />
            ))}
          </div>
        </div>
        <div className="w-96">
          {previewSrc ? <VideoPlayer src={previewSrc} adId={selected ?? undefined} filename={previewTitle ?? undefined} /> : <div className="p-4 bg-white rounded shadow">Select an ad to preview</div>}
        </div>
      </div>

      {/* TODO: Add pagination, sorting, and AI remix hooks for derivative ads */}

      {editorOpen && editorSrc && (
        <VideoEditor src={editorSrc} onClose={() => setEditorOpen(false)} onExported={(blob) => { console.log('Exported blob', blob); setEditorOpen(false) }} />
      )}
    </div>
  )
}


// --- UploadShortVideo component (kept short) ---
function UploadShortVideo() {
  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setMsg(null)
    if (!f) return setFile(null)

    // quick duration check using a video element
    const url = URL.createObjectURL(f)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.src = url
    await new Promise<void>((resolve) => {
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve()
      }
      v.onerror = () => {
        URL.revokeObjectURL(url)
        resolve()
      }
    })
    const dur = v.duration || 0
    if (!dur || dur > 10) {
      setMsg('Video must be 10s or shorter')
      return setFile(null)
    }
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setMsg(null)
    try {
      const sess = await supabase.auth.getSession()
      if (!sess || !sess.data.session) throw new Error('Sign in to upload')

      const ts = Date.now()
      const path = `uploads/${ts}-${file.name.replace(/[^a-z0-9_.-]/gi, '_')}`
      const bucket = 'ads-raw'

      const up = await supabase.storage.from(bucket).upload(path, file)
      if (up.error) throw up.error

      // Enqueue an AdUpload row (worker will process)
      const userId = sess?.data?.session?.user?.id || null
      const { data: inserted, error: insertErr } = await (supabase as any).from('AdUpload').insert([{ storagePath: path, filename: file.name, size: file.size, userId }])
      if (insertErr) throw insertErr

      setMsg('Uploaded. Processing will start shortly')
      setFile(null)
      setTitle('')
      // Optionally refresh list after a delay
      setTimeout(() => window.location.reload(), 1400)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input type="file" accept="video/*" onChange={onFileChange} />
      <input className="mt-2 w-full" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <Button onClick={handleUpload} disabled={!file || loading}>{loading ? 'Uploading...' : 'Upload'}</Button>
        <Button variant="ghost" onClick={() => { setFile(null); setTitle(''); setMsg(null) }}>Clear</Button>
      </div>
      {msg && <div className="mt-2 text-sm text-red-500">{msg}</div>}
    </div>
  )
}

