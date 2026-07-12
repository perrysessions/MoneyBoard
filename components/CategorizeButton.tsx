'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'

export function CategorizeButton({ uncategorized }: { uncategorized: number }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/categorize', { method: 'POST' })
    const data = await res.json().catch(() => ({ error: 'Server error' }))
    if (data.error) {
      const is429 = data.error.includes('429') || data.error.includes('quota')
      setResult(is429 ? 'quota-exceeded' : 'error')
      setLoading(false)
      return
    }
    if (data.categorized === 0) {
      setResult('All categorized')
    } else if (data.merchants === 0) {
      setResult(`${data.categorized} categorized (all from cache — 0 Gemini calls)`)
    } else {
      const cacheNote = data.fromCache > 0 ? `, ${data.fromCache} from cache` : ''
      setResult(`${data.categorized} categorized (${data.merchants} new via Gemini${cacheNote})`)
    }
    setLoading(false)
    setTimeout(() => window.location.reload(), 1200)
  }

  const resultLabel =
    result === 'quota-exceeded' ? '⚠ Gemini quota exceeded — try tomorrow or enable billing'
    : result === 'error' ? '⚠ Categorize failed'
    : result

  return (
    <div className="flex flex-col items-end gap-1">
      {result && <span className="text-xs text-orange-500 max-w-[200px] text-right leading-tight">{resultLabel}</span>}
      <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        disabled={loading || uncategorized === 0}
        className="gap-1.5"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Sparkles className="h-3.5 w-3.5" />}
        {uncategorized > 0 ? `Categorize (${uncategorized})` : 'All categorized'}
      </Button>
      </div>
    </div>
  )
}
