'use client'

import { useState } from 'react'
import { EyeOff } from 'lucide-react'

export function ExcludeButton({
  transactionId,
  isExcluded,
}: {
  transactionId: string
  isExcluded: boolean
}) {
  const [excluded, setExcluded] = useState(isExcluded)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/${transactionId}/exclude`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_excluded: !excluded }),
      })
      if (res.ok) setExcluded(e => !e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={excluded ? 'Mark as expense (un-exclude)' : 'Exclude from expenses'}
      className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
        excluded
          ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
          : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
      }`}
    >
      <EyeOff className={`h-3 w-3 ${excluded ? '' : 'opacity-40'}`} />
      {excluded ? 'Excluded' : 'Exclude'}
    </button>
  )
}
