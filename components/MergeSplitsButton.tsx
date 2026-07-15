'use client'

import { useState } from 'react'
import { GitMerge } from 'lucide-react'

export function MergeSplitsButton({ transactionId }: { transactionId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const merge = async () => {
    setLoading(true)
    await fetch(`/api/transactions/${transactionId}/splits/merge`, { method: 'DELETE' })
    window.location.reload()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">Undo all splits?</span>
        <button onClick={merge} disabled={loading} className="text-xs px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
          {loading ? 'Merging…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
    >
      <GitMerge className="h-3 w-3" />
      Merge splits
    </button>
  )
}
