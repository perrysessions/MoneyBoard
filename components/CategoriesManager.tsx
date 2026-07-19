'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Entry = [string, number] // [name, txCount]

function CategoryRow({
  entry,
  field,
  onDone,
}: {
  entry: Entry
  field: 'category' | 'subcategory'
  onDone: () => void
}) {
  const [name, count] = entry
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(name)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rename = async () => {
    if (!newName.trim() || newName.trim() === name) { setEditing(false); return }
    setLoading(true)
    const res = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, oldValue: name, newValue: newName.trim() }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setError(data.error); return }
    onDone()
  }

  const remove = async () => {
    setLoading(true)
    const res = await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value: name }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setError(data.error); return }
    onDone()
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
      {editing ? (
        <>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 text-sm border border-blue-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={rename} disabled={loading} className="text-blue-500 hover:text-blue-700 disabled:opacity-40">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => { setEditing(false); setNewName(name) }} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </>
      ) : confirming ? (
        <>
          <span className="flex-1 text-sm text-gray-700">Remove <strong>{name}</strong> from {count} transaction{count !== 1 ? 's' : ''}?</span>
          <button onClick={remove} disabled={loading} className="text-xs px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-40">
            {loading ? 'Removing…' : 'Yes, remove'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-gray-800">{name}</span>
          <span className="text-xs text-gray-400 tabular-nums">{count} tx</span>
          <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-blue-500 transition-colors p-1">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setConfirming(true)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-500 mt-1 col-span-full">{error}</p>}
    </div>
  )
}

export function CategoriesManager({
  customCategories,
  customSubcategories,
}: {
  customCategories: Entry[]
  customSubcategories: Entry[]
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="space-y-6">
      {/* Custom Categories */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Custom Categories</h2>
          <p className="text-xs text-gray-400 mt-0.5">Categories you've created by typing custom names</p>
        </div>
        {customCategories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No custom categories yet</p>
        ) : (
          <div>
            {customCategories.map(entry => (
              <CategoryRow key={entry[0]} entry={entry} field="category" onDone={refresh} />
            ))}
          </div>
        )}
      </div>

      {/* Custom Subcategories */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Custom Subcategories</h2>
          <p className="text-xs text-gray-400 mt-0.5">Subcategories you've created by typing custom names</p>
        </div>
        {customSubcategories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No custom subcategories yet</p>
        ) : (
          <div>
            {customSubcategories.map(entry => (
              <CategoryRow key={entry[0]} entry={entry} field="subcategory" onDone={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
