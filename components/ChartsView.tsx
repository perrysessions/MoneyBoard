'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { List, Calendar } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'

type Tx = {
  date: string
  amount_cents: number
  merchant_name: string
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

type DateRange =
  | { mode: 'preset'; i: number }
  | { mode: 'month'; m: string }
  | { mode: 'custom'; from: string; to: string }

const DEFAULT_PIE_RANGE: DateRange = { mode: 'preset', i: 1 }
const DEFAULT_LINE_RANGE: DateRange = { mode: 'preset', i: 5 }
const DEFAULT_TABLE_RANGE: DateRange = { mode: 'preset', i: 1 }

function filterByRange(txs: Tx[], range: DateRange): Tx[] {
  if (range.mode === 'preset') {
    const days = PRESETS[range.i].days
    if (days >= 9999) return txs
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return txs.filter(t => t.date >= cutoff.toISOString().slice(0, 10))
  }
  if (range.mode === 'month') return txs.filter(t => t.date.startsWith(range.m))
  return txs.filter(t => (!range.from || t.date >= range.from) && (!range.to || t.date <= range.to))
}

function rangeDateParams(range: DateRange): string {
  if (range.mode === 'preset') {
    const days = PRESETS[range.i].days
    if (days >= 9999) return ''
    return `&dateFrom=${new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)}&dateTo=${new Date().toISOString().slice(0, 10)}`
  }
  if (range.mode === 'month') {
    const [y, m] = range.m.split('-').map(Number)
    return `&dateFrom=${range.m}-01&dateTo=${new Date(y, m, 0).toISOString().slice(0, 10)}`
  }
  return `&dateFrom=${range.from}&dateTo=${range.to}`
}

function DateRangeBar({ value, onChange, months }: { value: DateRange; onChange: (r: DateRange) => void; months: string[] }) {
  const [showMonth, setShowMonth] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const monthRef = useRef<HTMLDivElement>(null)
  const customRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) setShowMonth(false)
      if (customRef.current && !customRef.current.contains(e.target as Node)) setShowCustom(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isPreset = (i: number) => value.mode === 'preset' && value.i === i
  const isMonth = value.mode === 'month'
  const isCustom = value.mode === 'custom'

  const monthLabel = isMonth ? new Date((value as { mode: 'month'; m: string }).m + '-02').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Month'

  return (
    <div className="flex gap-1 flex-wrap items-center">
      {PRESETS.map((p, i) => (
        <button key={p.label} onClick={() => { onChange({ mode: 'preset', i }); setShowMonth(false); setShowCustom(false) }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isPreset(i) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {p.label}
        </button>
      ))}
      <div ref={monthRef} className="relative">
        <button onClick={() => { setShowMonth(o => !o); setShowCustom(false) }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${isMonth || showMonth ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          <Calendar className="h-3 w-3" />
          {monthLabel}
        </button>
        {showMonth && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {months.map(m => {
                const active = isMonth && (value as { mode: 'month'; m: string }).m === m
                return (
                  <button key={m} onClick={() => { onChange({ mode: 'month', m }); setShowMonth(false) }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-blue-50 hover:text-blue-700 ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                    {new Date(m + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div ref={customRef} className="relative">
        <button onClick={() => { setShowCustom(o => !o); setShowMonth(false) }}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isCustom || showCustom ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          Custom
        </button>
        {showCustom && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 space-y-2">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <button onClick={() => { if (customFrom && customTo) { onChange({ mode: 'custom', from: customFrom, to: customTo }); setShowCustom(false) } }}
              disabled={!customFrom || !customTo}
              className="w-full py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  )
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
  const [pieRange, setPieRange] = useState<DateRange>(DEFAULT_PIE_RANGE)
  const [lineRange, setLineRange] = useState<DateRange>(DEFAULT_LINE_RANGE)
  const [tableRange, setTableRange] = useState<DateRange>(DEFAULT_TABLE_RANGE)
  const [lineCategory, setLineCategory] = useState('__all__')
  const [useSubcategory, setUseSubcategory] = useState(false)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    const sub = ls('charts-use-subcategory', false)
    setPieRange(ls('charts-pie-range', DEFAULT_PIE_RANGE))
    setLineRange(ls('charts-line-range', DEFAULT_LINE_RANGE))
    setTableRange(ls('charts-table-range', DEFAULT_TABLE_RANGE))
    setLineCategory(ls('charts-line-category', '__all__'))
    setUseSubcategory(sub)
    setHiddenCategories(new Set(ls<string[]>(sub ? 'charts-hidden-sub' : 'charts-hidden-primary', [])))
  }, [])

  const months = useMemo(() => {
    if (!earliest) return []
    const start = new Date(earliest.slice(0, 7) + '-02')
    const result: string[] = []
    const cur = new Date()
    cur.setDate(1)
    while (cur >= start) {
      result.push(cur.toISOString().slice(0, 7))
      cur.setMonth(cur.getMonth() - 1)
    }
    return result
  }, [earliest])

  const handleTableRange = (r: DateRange) => { setTableRange(r); lsSet('charts-table-range', r) }

  const toggleExpand = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const handlePieRange = (r: DateRange) => { setPieRange(r); lsSet('charts-pie-range', r) }
  const handleLineRange = (r: DateRange) => { setLineRange(r); lsSet('charts-line-range', r) }
  const handleLineCategory = (v: string) => { setLineCategory(v); lsSet('charts-line-category', v) }

  const handleSubToggle = (v: boolean) => {
    lsSet(useSubcategory ? 'charts-hidden-sub' : 'charts-hidden-primary', [...hiddenCategories])
    const restored = new Set(ls<string[]>(v ? 'charts-hidden-sub' : 'charts-hidden-primary', []))
    setHiddenCategories(restored)
    setUseSubcategory(v)
    lsSet('charts-use-subcategory', v)
  }

  const pieTxs = useMemo(() => filterByRange(transactions, pieRange), [transactions, pieRange])

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

  const lineTxs = useMemo(() => filterByRange(transactions, lineRange), [transactions, lineRange])
  const lineData = useMemo(() => groupByMonth(lineTxs, lineCategory, useSubcategory), [lineTxs, lineCategory, useSubcategory])

  const tableTxs = useMemo(() => filterByRange(transactions, tableRange), [transactions, tableRange])

  // Build category → vendor → {total, count} map
  const tableData = useMemo(() => {
    const catMap = new Map<string, Map<string, { total: number; count: number }>>()
    for (const t of tableTxs) {
      const cat = getKey(t, useSubcategory)
      if (!catMap.has(cat)) catMap.set(cat, new Map())
      const vendorMap = catMap.get(cat)!
      const vendor = t.merchant_name
      const existing = vendorMap.get(vendor) ?? { total: 0, count: 0 }
      vendorMap.set(vendor, { total: existing.total + t.amount_cents, count: existing.count + 1 })
    }
    // Sort categories by total desc, vendors within each by total desc
    return [...catMap.entries()]
      .map(([cat, vendorMap]) => {
        const vendors = [...vendorMap.entries()]
          .map(([name, { total, count }]) => ({ name, total, count }))
          .sort((a, b) => b.total - a.total)
        const catTotal = vendors.reduce((s, v) => s + v.total, 0)
        return { cat, catTotal, vendors }
      })
      .sort((a, b) => b.catTotal - a.catTotal)
  }, [tableTxs, useSubcategory])

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
          <DateRangeBar value={pieRange} onChange={handlePieRange} months={months} />
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
                const dateParams = rangeDateParams(pieRange)
                const txUrl = `/dashboard/transactions?${useSubcategory ? 'subcategory' : 'category'}=${encodeURIComponent(rawKey)}${dateParams}`
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
            <DateRangeBar value={lineRange} onChange={handleLineRange} months={months} />
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

      {/* Vendor breakdown table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Vendor Breakdown by {useSubcategory ? 'Subcategory' : 'Category'}
          </h2>
          <DateRangeBar value={tableRange} onChange={handleTableRange} months={months} />
        </div>

        {tableData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>
        ) : (
          <div className="space-y-2">
            {tableData.map(({ cat, catTotal, vendors }) => {
              const isExpanded = expandedCats.has(cat)
              const catIdx = allCategories.indexOf(cat)
              const color = COLORS[catIdx >= 0 ? catIdx % COLORS.length : 0]
              return (
                <div key={cat} className="rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(cat)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-gray-700 flex-1">{cat}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</span>
                    <span className="text-xs font-semibold text-gray-800 tabular-nums ml-2">{fmt(catTotal)}</span>
                    <span className="text-gray-300 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div>
                      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-100 bg-white">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide flex-1">Vendor</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-12 text-right">Count</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-16 text-right">Total</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide w-10 text-right">% Cat</span>
                      </div>
                      {vendors.map(v => {
                        const pct = catTotal > 0 ? Math.round((v.total / catTotal) * 100) : 0
                        return (
                          <div key={v.name} className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                            <span className="text-xs text-gray-700 flex-1 truncate">{v.name}</span>
                            <span className="text-xs text-gray-400 tabular-nums w-12 text-right">{v.count}×</span>
                            <span className="text-xs font-medium text-gray-800 tabular-nums w-16 text-right">{fmt(v.total)}</span>
                            <span className="text-xs text-gray-400 tabular-nums w-10 text-right">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
