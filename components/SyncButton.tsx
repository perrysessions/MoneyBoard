'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'

export function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const sync = async () => {
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/plaid/sync', { method: 'POST' })
    const data = await res.json()
    setResult(`${data.synced} transactions synced`)
    setLoading(false)
    // Reload to reflect new data
    setTimeout(() => window.location.reload(), 1000)
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-gray-500">{result}</span>}
      <Button variant="outline" size="sm" onClick={sync} disabled={loading}>
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <RefreshCw className="h-4 w-4" />}
        <span className="ml-1">Sync</span>
      </Button>
    </div>
  )
}
