'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'

type Preset = 'thisMonth' | 'lastMonth' | '30d' | '3m' | 'ytd' | 'all' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: '30d', label: '30 Days' },
  { key: '3m', label: '3 Months' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All Time' },
]

const LS_KEY = 'dashboardDatePreset'

function presetDates(preset: Preset): { from: string; to: string } | null {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  if (preset === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: fmt(from), to: fmt(today) }
  }
  if (preset === 'lastMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (preset === '30d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 30)
    return { from: fmt(from), to: fmt(today) }
  }
  if (preset === '3m') {
    const from = new Date(today)
    from.setMonth(from.getMonth() - 3)
    return { from: fmt(from), to: fmt(today) }
  }
  if (preset === 'ytd') {
    return { from: `${today.getFullYear()}-01-01`, to: fmt(today) }
  }
  if (preset === 'all') {
    return null
  }
  return null
}

export function DashboardDateFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const currentPreset = (sp.get('preset') as Preset) ?? 'thisMonth'

  // On mount: if no URL params, restore from localStorage
  useEffect(() => {
    if (!sp.has('preset') && !sp.has('from')) {
      const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)) as Preset | null
      const preset = saved ?? 'thisMonth'
      applyPreset(preset)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyPreset = (preset: Preset) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, preset)
    const params = new URLSearchParams()
    params.set('preset', preset)
    const dates = presetDates(preset)
    if (dates) {
      params.set('from', dates.from)
      params.set('to', dates.to)
    }
    router.push(`${pathname}?${params.toString()}`)
    setShowCustom(false)
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, 'custom')
    const params = new URLSearchParams()
    params.set('preset', 'custom')
    params.set('from', customFrom)
    params.set('to', customTo)
    router.push(`${pathname}?${params.toString()}`)
    setShowCustom(false)
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              currentPreset === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(o => !o)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            currentPreset === 'custom'
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <Calendar className="h-3 w-3" />
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
