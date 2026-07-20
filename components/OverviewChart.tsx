'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface RawTx {
  date: string          // 'YYYY-MM-DD'
  amount_cents: number  // positive = spend, negative = income
}

interface Props {
  transactions: RawTx[]
  dateFrom: string | undefined
  dateTo: string | undefined
}

type Granularity = 'day' | 'week' | 'month'

function weekKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7)) // Monday
  return mon.toISOString().slice(0, 10)
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // 'YYYY-MM'
}

function groupKey(dateStr: string, gran: Granularity) {
  if (gran === 'day') return dateStr
  if (gran === 'week') return weekKey(dateStr)
  return monthKey(dateStr)
}

function formatLabel(key: string, gran: Granularity) {
  if (gran === 'month') {
    const [y, m] = key.split('-')
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  const d = new Date(key + 'T00:00:00')
  if (gran === 'week') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const fmtDollar = (cents: number) => {
  const n = Math.abs(cents) / 100
  if (n >= 10000) return '$' + (n / 1000).toFixed(1) + 'k'
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function OverviewChart({ transactions, dateFrom, dateTo }: Props) {
  const [gran, setGran] = useState<Granularity>('day')
  const [showSpend, setShowSpend] = useState(true)
  const [showIncome, setShowIncome] = useState(true)

  const chartData = useMemo(() => {
    const buckets = new Map<string, { spend: number; income: number }>()

    for (const tx of transactions) {
      const key = groupKey(tx.date, gran)
      const b = buckets.get(key) ?? { spend: 0, income: 0 }
      if (tx.amount_cents > 0) b.spend += tx.amount_cents
      else b.income += Math.abs(tx.amount_cents)
      buckets.set(key, b)
    }

    // Fill in all dates in range so gaps show as 0
    if (dateFrom && dateTo) {
      const cursor = new Date(dateFrom + 'T00:00:00')
      const end = new Date(dateTo + 'T00:00:00')
      while (cursor <= end) {
        const k = groupKey(cursor.toISOString().slice(0, 10), gran)
        if (!buckets.has(k)) buckets.set(k, { spend: 0, income: 0 })
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { spend, income }]) => ({
        key,
        label: formatLabel(key, gran),
        spend,
        income,
      }))
  }, [transactions, gran, dateFrom, dateTo])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2 text-xs">
        <p className="font-medium text-gray-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey === 'spend' ? 'Spend' : 'Income'}: {fmtDollar(p.value)}
          </p>
        ))}
      </div>
    )
  }

  const granBtns: { key: Granularity; label: string }[] = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ]

  if (!chartData.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSpend(s => !s)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
              showSpend
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showSpend ? 'bg-rose-400' : 'bg-gray-300'}`} />
            Spend
          </button>
          <button
            onClick={() => setShowIncome(s => !s)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
              showIncome
                ? 'bg-green-50 border-green-200 text-green-600'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showIncome ? 'bg-green-400' : 'bg-gray-300'}`} />
            Income
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {granBtns.map(b => (
            <button
              key={b.key}
              onClick={() => setGran(b.key)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                gran === b.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v === 0 ? '' : fmtDollar(v)}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          {showSpend && (
            <Line
              type="monotone"
              dataKey="spend"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#f87171' }}
            />
          )}
          {showIncome && (
            <Line
              type="monotone"
              dataKey="income"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#34d399' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
