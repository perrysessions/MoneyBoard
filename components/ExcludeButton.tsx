'use client'

import { useState } from 'react'
import { EyeOff } from 'lucide-react'

export function ExcludeButton({
  transactionId,
  isExcluded,
  isExcludedTotals,
  amountCents,
}: {
  transactionId: string
  isExcluded: boolean
  isExcludedTotals: boolean
  amountCents: number
}) {
  const [excluded, setExcluded] = useState(isExcluded)
  const [excludedTotals, setExcludedTotals] = useState(isExcludedTotals)
  const [loading, setLoading] = useState(false)

  const patch = async (field: 'is_excluded' | 'is_excluded_totals', value: boolean) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/${transactionId}/exclude`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        if (field === 'is_excluded') setExcluded(value)
        else setExcludedTotals(value)
      }
    } finally {
      setLoading(false)
    }
  }

  const isIncome = amountCents < 0
  const totalsLabel = isIncome ? 'Income' : 'Expenses'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Exclude from totals only */}
      {!excluded && (
        <button
          onClick={() => patch('is_excluded_totals', !excludedTotals)}
          disabled={loading}
          title={excludedTotals ? `Include in ${totalsLabel}` : `Exclude from ${totalsLabel} totals only — still shows in charts`}
          className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
            excludedTotals
              ? 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100'
              : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
          }`}
        >
          <EyeOff className={`h-3 w-3 ${excludedTotals ? '' : 'opacity-40'}`} />
          {excludedTotals ? `Excl. from ${totalsLabel}` : `Excl. from ${totalsLabel}`}
        </button>
      )}

      {/* Exclude everywhere */}
      {!excludedTotals && (
        <button
          onClick={() => patch('is_excluded', !excluded)}
          disabled={loading}
          title={excluded ? 'Un-exclude (include everywhere)' : 'Exclude everywhere — hides from totals and charts'}
          className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
            excluded
              ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
              : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
          }`}
        >
          <EyeOff className={`h-3 w-3 ${excluded ? '' : 'opacity-40'}`} />
          {excluded ? 'Excl. Everywhere' : 'Excl. Everywhere'}
        </button>
      )}
    </div>
  )
}
