'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { List } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'

type Tx = {
  date: string
  amount_cents: number
  category: string      // display name
  subcategory: string   // display name
  categoryKey: string   // raw Plaid key for URL filter
  subcategoryKey: string
}

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
  '#6366f1','#a855f7','#22c55e','#eab308','#64748b',
  '#0ea5e9','#d946ef','#fb923c',
]

const fmt = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const PRESETS = [
  { label: '30D',  days: 30 },
  { label: '3M',   days: 90 },
  { label: '6M',   days: 180 },
  { label: '1Y',   days: 365 },
  { label: '2Y',   days: 730 },
  { label: 'All',  days: 9999 },
]

function filterByDays(txs: Tx[], days: number) {
  if (days >= 9999) return txs
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return txs.filter(t => t.date >= cutoffStr)
}

function getKey(t: Tx, sub: boolean) {
  return sub ? t.subcategory : t.category
}

function groupByCategory(txs: Tx[], hidden: Set<string>, sub: boolean) {
  const map: Record<string, number> = {}
  for (const t of txs) {
    const key = getKey(t, sub)
    if (hidden.has(key)) continue
    map[key] = (map[key] ?? 0) + t.amount_cents
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function groupByMonth(txs: Tx[], category: string, sub: boolean) {
  const filtered = category === '__all__' ? txs : txs.filter(t => getKey(t, sub) === category)
  const map: Record<string, number> = {}
  for (const t of filtered) {
    const month = t.date.slice(0, 7)
    map[month] = (map[month] ?? 0) + t.amount_cents
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({
      month,
      label: new Date(month + '-02').toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      total,
    }))
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-md rounded-xl px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600 font-semibold">{fmt(payload[0].value)}</p>
    </div>
  )
}

function PresetBar({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <div className="flex gap-1">
      {PRESETS.map((p, i) => (
        <button
          key={p.label}
          onClick={() => onChange(i)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            value === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function SubToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
      <button
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 transition-colors ${!value ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
      >
        Category
      </button>
      <button
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 transition-colors ${value ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
      >
        Subcategory
      </button>
    </div>
  )
}

function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function ChartsView({ transactions, earliest, latest }: { transactions: Tx[], earliest: string | null, latest: string | null }) {
  const [piePreset, setPiePreset] = useState(() => ls('charts-pie-preset', 1))
  const [linePreset, setLinePreset] = useState(() => ls('charts-line-preset', 5))
  const [lineCategory, setLineCategory] = useState(() => ls('charts-line-category', '__all__'))
  const [useSubcategory, setUseSubcategory] = useState(() => ls('charts-use-subcategory', false))
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(() =>
    new Set(ls<string[]>(useSubcategory ? 'charts-hidden-sub' : 'charts-hidden-primary', []))
  )

  const handlePiePreset = (i: number) => { setPiePreset(i); lsSet('charts-pie-preset', i) }
  const handleLinePreset = (i: number) => { setLinePreset(i); lsSet('charts-line-preset', i) }
  const handleLineCategory = (v: string) => { setLineCategory(v); lsSet('charts-line-category', v) }

  const handleSubToggle = (v: boolean) => {
    // Save current hidden set before switching modes
    lsSet(useSubcategory ? 'charts-hidden-sub' : 'charts-hidden-primary', [...hiddenCategories])
    // Restore the other mode's hidden set
    const restored = new Set(ls<string[]>(v ? 'charts-hidden-sub' : 'charts-hidden-primary', []))
    setHiddenCategories(restored)
    setUseSubcategory(v)
    lsSet('charts-use-subcategory', v)
  }

  const pieTxs = useMemo(() => filterByDays(transactions, PRESETS[piePreset].days), [transactions, piePreset])

  const { allCategories, displayToKey } = useMemo(() => {
    const map: Record<string, number> = {}
    const keyMap: Record<string, string> = {}
    for (const t of pieTxs) {
      const display = getKey(t, useSubcategory)
      const raw = useSubcategory ? t.subcategoryKey : t.categoryKey
      map[display] = (map[display] ?? 0) + t.amount_cents
      keyMap[display] = raw
    }
    return {
      allCategories: Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name]) => name),
      displayToKey: keyMap,
    }
  }, [pieTxs, useSubcategory])

  const lineCategories = useMemo(() =>
    [...new Set(transactions.map(t => getKey(t, useSubcategory)))].sort()
  , [transactions, useSubcategory])

  const pieData = useMemo(() => groupByCategory(pieTxs, hiddenCategories, useSubcategory), [pieTxs, hiddenCategories, useSubcategory])
  const pieTotal = useMemo(() => pieData.reduce((s, d) => s + d.value, 0), [pieData])

  const lineTxs = useMemo(() => filterByDays(transactions, PRESETS[linePreset].days), [transactions, linePreset])
  const lineData = useMemo(() => groupByMonth(lineTxs, lineCategory, useSubcategory), [lineTxs, lineCategory, useSubcategory])

  const toggleCategory = (cat: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      lsSet(useSubcategory ? 'charts-hidden-sub' : 'charts-hidden-primary', [...next])
      return next
    })
  }

  const colorIndex = useMemo(() => {
    const map: Record<string, number> = {}
    allCategories.forEach((cat, i) => { map[cat] = i })
    return map
  }, [allCategories])

  const hasData = pieData.length > 0

  return (
    <div className="space-y-6">
      {/* Global view toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Group by</p>
        <SubToggle value={useSubcategory} onChange={handleSubToggle} />
      </div>

      {/* Pie chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Spending by {useSubcategory ? 'Subcategory' : 'Category'}
          </h2>
          <PresetBar value={piePreset} onChange={handlePiePreset} />
        </div>

        {!hasData ? (
          <p className="text-sm text-gray-400 text-center py-8">No categorized spending for this period</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="sm:w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={COLORS[colorIndex[d.name] % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => fmt(Number(v))}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto max-h-[260px]">
              {allCategories.map(cat => {
                const isHidden = hiddenCategories.has(cat)
                const entry = pieData.find(d => d.name === cat)
                const pct = entry && pieTotal > 0 ? Math.round((entry.value / pieTotal) * 100) : 0
                const color = COLORS[colorIndex[cat] % COLORS.length]
                const rawKey = displayToKey[cat] ?? ''
                const txUrl = `/dashboard/transactions?${useSubcategory ? 'subcategory' : 'category'}=${encodeURIComponent(rawKey)}`
                return (
                  <div key={cat} className={`flex items-center gap-1 rounded-lg ${isHidden ? 'opacity-35' : ''}`}>
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="flex items-center gap-2 px-2 py-1 flex-1 min-w-0 text-left transition-colors hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isHidden ? '#d1d5db' : color }} />
                      <span className="text-xs text-gray-700 flex-1 truncate">{cat}</span>
                      {!isHidden && entry && (
                        <>
                          <span className="text-xs text-gray-400 tabular-nums">{fmt(entry.value)}</span>
                          <span className="text-xs font-medium text-gray-500 tabular-nums w-8 text-right">{pct}%</span>
                        </>
                      )}
                      {isHidden && <span className="text-xs text-gray-300 ml-auto">hidden</span>}
                    </button>
                    <Link
                      href={txUrl}
                      title={`View ${cat} transactions`}
                      className="shrink-0 p-1 text-gray-300 hover:text-blue-500 transition-colors rounded"
                    >
                      <List className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Line chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Spending Trend</h2>
            {earliest && <p className="text-xs text-gray-400 mt-0.5">Data from {earliest} to {latest}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={lineCategory}
              onChange={e => handleLineCategory(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="__all__">All {useSubcategory ? 'Subcategories' : 'Categories'}</option>
              {lineCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <PresetBar value={linePreset} onChange={handleLinePreset} />
          </div>
        </div>

        {lineData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => '$' + (v / 100).toLocaleString('en-US', { notation: 'compact' })} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
