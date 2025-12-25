import React from 'react'

type FiltersState = {
  platform?: string
  industry?: string
  hookType?: string
  ctaType?: string
}

type Props = {
  value: FiltersState
  onChange: (next: FiltersState) => void
}

export const Filters: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="p-3 bg-white rounded-lg shadow">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <select className="border p-2 rounded" value={value.platform || ''} onChange={(e) => onChange({ ...value, platform: e.target.value || undefined })}>
          <option value="">All platforms</option>
          <option value="TIKTOK">TikTok</option>
          <option value="META">Meta</option>
          <option value="YOUTUBE">YouTube</option>
        </select>
        <input placeholder="Industry" className="border p-2 rounded" value={value.industry || ''} onChange={(e) => onChange({ ...value, industry: e.target.value || undefined })} />
        <input placeholder="Hook type" className="border p-2 rounded" value={value.hookType || ''} onChange={(e) => onChange({ ...value, hookType: e.target.value || undefined })} />
        <input placeholder="CTA type" className="border p-2 rounded" value={value.ctaType || ''} onChange={(e) => onChange({ ...value, ctaType: e.target.value || undefined })} />
      </div>
    </div>
  )
}

export default Filters
