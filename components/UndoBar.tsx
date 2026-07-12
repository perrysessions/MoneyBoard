'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getUndoHistory, removeUndoEntry, type UndoEntry } from '@/lib/undoHistory'

export function UndoBar() {
  const router = useRouter()
  const [history, setHistory] = useState<UndoEntry[]>([])
  const [open, setOpen] = useState(false)
  const [undoing, setUndoing] = useState<string | null>(null)

  const refresh = () => setHistory(getUndoHistory())

  useEffect(() => {
    refresh()
    window.addEventListener('undo-history-change', refresh)
    return () => window.removeEventListener('undo-history-change', refresh)
  }, [])

  if (!history.length) return null

  const handleUndo = async (entry: UndoEntry) => {
    setUndoing(entry.id)
    const res = await fetch('/api/transactions/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: entry.changes }),
    })
    const data = await res.json()
    if (data.ok) {
      removeUndoEntry(entry.id)
      setOpen(false)
      window.location.reload()
    }
    setUndoing(null)
  }

  const timeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

  return (
    <div className="relative mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo history ({history.length})
        {open ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-100 rounded-2xl shadow-lg p-2 min-w-[320px] max-w-sm space-y-1">
          {history.map(entry => (
            <div key={entry.id} className="flex items-start gap-2 px-2 py-2 rounded-xl hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 leading-snug">{entry.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.changes.length} transaction{entry.changes.length !== 1 ? 's' : ''} · {timeAgo(entry.timestamp)}
                </p>
              </div>
              <button
                onClick={() => handleUndo(entry)}
                disabled={!!undoing}
                className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {undoing === entry.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Undo2 className="h-3 w-3" />}
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
