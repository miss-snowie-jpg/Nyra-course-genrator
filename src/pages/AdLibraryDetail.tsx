import React from 'react'
import VideoPlayer from '../components/AdLibrary/VideoPlayer'

export default function AdLibraryDetail({ id }: { id?: string }) {
  const [ad, setAd] = React.useState<any | null>(null)
  const [jobInterval, setJobInterval] = React.useState<string>('1440')
  const [refreshInterval, setRefreshInterval] = React.useState<string>('1440')
  const [jobProcessing, setJobProcessing] = React.useState<boolean>(false)
  const [jobMessage, setJobMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    ;(async () => {
      const res = await fetch(`/api/ad-library/${id}`)
      if (res.ok) setAd(await res.json())
    })()
  }, [id])

  async function startJob(type: 'REPOST' | 'REFRESH') {
    if (!id) return
    setJobProcessing(true)
    setJobMessage(null)
    try {
      const body: any = { adId: id, type, intervalMin: type === 'REPOST' ? Number(jobInterval) : Number(refreshInterval) }
      const res = await fetch('/supabase/functions/v1/manage-ad-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const text = await res.text()
      if (!res.ok) throw new Error(text)
      setJobMessage('Job started')
    } catch (err) {
      setJobMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setJobProcessing(false)
    }
  }

  async function stopJob(type: 'REPOST' | 'REFRESH') {
    if (!id) return
    setJobProcessing(true)
    setJobMessage(null)
    try {
      const res = await fetch('/supabase/functions/v1/manage-ad-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adId: id, action: 'stop' }) })
      const text = await res.text()
      if (!res.ok) throw new Error(text)
      setJobMessage('Job stopped')
    } catch (err) {
      setJobMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setJobProcessing(false)
    }
  }

  if (!ad) return <div className="p-4">Loading...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ad.title}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <VideoPlayer src={ad.sourceUrl} adId={ad.id} />
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

      <div className="mt-4 p-4 bg-white rounded shadow">
        <h4 className="text-sm font-semibold">Auto Jobs</h4>
        <div className="mt-2 flex gap-2 items-center">
          <Input placeholder="Interval in minutes (e.g., 1440)" value={jobInterval} onChange={(e) => setJobInterval((e.target as HTMLInputElement).value)} />
          <Button onClick={() => startJob('REPOST')} disabled={jobProcessing}>{jobProcessing ? 'Working...' : 'Start Repost'}</Button>
          <Button variant="ghost" onClick={() => stopJob('REPOST')} disabled={jobProcessing}>Stop Repost</Button>
        </div>
        <div className="mt-2 flex gap-2 items-center">
          <Input placeholder="Interval in minutes (e.g., 1440)" value={refreshInterval} onChange={(e) => setRefreshInterval((e.target as HTMLInputElement).value)} />
          <Button onClick={() => startJob('REFRESH')} disabled={jobProcessing}>{jobProcessing ? 'Working...' : 'Start Refresh'}</Button>
          <Button variant="ghost" onClick={() => stopJob('REFRESH')} disabled={jobProcessing}>Stop Refresh</Button>
        </div>
        {jobMessage && <div className="mt-2 text-sm">{jobMessage}</div>}
      </div>

      {/* TODO: Add AI remix panel to generate derivative creatives */}
    </div>
  )
}
