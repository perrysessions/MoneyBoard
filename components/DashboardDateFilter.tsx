'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

type Preset = 'thisMonth' | 'lastMonth' | '30d' | '3m' | 'ytd' | 'all' | 'custom'

function getAllMonths(earliestDate: string | null): { label: string; from: string; to: string }[] {
  const months = []
  const today = new Date()
  const earliest = earliestDate ? new Date(earliestDate.slice(0, 7) + '-02') : new Date(today.getFullYear(), today.getMonth() - 12, 1)
  const cur = new Date(today.getFullYear(), today.getMonth(), 1)
  while (cur >= earliest) {
    const from = cur.toISOString().slice(0, 10)
    const to = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).toISOString().slice(0, 10)
    const label = cur.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    months.push({ label, from, to })
    cur.setMonth(cur.getMonth() - 1)
  }
  return months
}

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

export function DashboardDateFilter({ earliestDate }: { earliestDate?: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [showMonthMenu, setShowMonthMenu] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const monthMenuRef = useRef<HTMLDivElement>(null)
  const customRef = useRef<HTMLDivElement>(null)
  const allMonths = getAllMonths(earliestDate ?? null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target as Node)) {
        setShowMonthMenu(false)
      }
      if (customRef.current && !customRef.current.contains(e.target as Node)) {
        setShowCustom(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    setShowMonthMenu(false)
  }

  const applyMonth = (from: string, to: string, label: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, 'custom')
    const params = new URLSearchParams()
    params.set('preset', 'custom')
    params.set('from', from)
    params.set('to', to)
    router.push(`${pathname}?${params.toString()}`)
    setShowMonthMenu(false)
  }

  const applyCustomDates = () => {
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

        {/* Month picker dropdown */}
        <div ref={monthMenuRef} className="relative">
          <button
            onClick={() => { setShowMonthMenu(o => !o); setShowCustom(false) }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              currentPreset === 'custom' && !showCustom
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            <Calendar className="h-3 w-3" />
            Month
            <ChevronDown className="h-3 w-3" />
          </button>

          {showMonthMenu && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
              <div className="max-h-48 overflow-y-auto">
                {allMonths.map(m => (
                  <button
                    key={m.from}
                    onClick={() => applyMonth(m.from, m.to, m.label)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom date range picker */}
        <div ref={customRef} className="relative">
          <button
            onClick={() => { setShowCustom(o => !o); setShowMonthMenu(false) }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              showCustom
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            Custom
            <ChevronDown className="h-3 w-3" />
          </button>

          {showCustom && (
            <div className="absolute left-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={applyCustomDates}
                disabled={!customFrom || !customTo}
                className="w-full py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
