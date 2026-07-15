'use client'

import { useState, useRef, useEffect } from 'react'
import { PLAID_PRIMARY_CATEGORIES, PRIMARY_LABELS, formatCategory } from '@/lib/categories'
import { ChevronDown, X, Search } from 'lucide-react'
import { addUndoEntry } from '@/lib/undoHistory'

type Scope = 'single' | 'all_past' | 'all'

function suggestPattern(merchantNormalized: string): string {
  const m = merchantNormalized.match(/^(.*?)\s+\d/)
  return m ? m[1].trim() : merchantNormalized
}

interface Props {
  transactionId: string
  userCategory: string | null
  plaidCategory: string | null
  plaidSubcategory: string | null
  merchantName: string
  merchantNormalized: string
  txDate: string
  onSaved?: () => void
  onCategoryChange?: (newCategory: string | null) => void
  customCategories?: string[]
}

export function CategoryPicker({
  transactionId, userCategory, plaidCategory, plaidSubcategory,
  merchantName, merchantNormalized, txDate, onSaved, onCategoryChange, customCategories = [],
}: Props) {
  const [value, setValue] = useState<string | null>(userCategory)
  const [pending, setPending] = useState<string | null | undefined>(undefined)
  const [pattern, setPattern] = useState('')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isOverridden = !!value

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openDropdown = () => {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const q = query.trim().toLowerCase()

  // Filter Plaid categories by query
  const filteredPlaid = PLAID_PRIMARY_CATEGORIES.filter(key =>
    !q || PRIMARY_LABELS[key].toLowerCase().includes(q)
  )

  // Filter custom categories by query
  const filteredCustom = customCategories.filter(c =>
    !q || c.toLowerCase().includes(q)
  )

  // Show "Create" when query has text and doesn't match any existing label
  const exactMatch =
    PLAID_PRIMARY_CATEGORIES.some(k => PRIMARY_LABELS[k].toLowerCase() === q) ||
    customCategories.some(c => c.toLowerCase() === q)
  const showCreate = q.length > 0 && !exactMatch

  const handleSelect = (newVal: string | null) => {
    setOpen(false)
    setQuery('')
    if (newVal === value) return
    setPattern(suggestPattern(merchantNormalized))
    setPending(newVal)
  }

  const applyScope = async (scope: Scope) => {
    if (pending === undefined) return
    setSaving(true)

    const res = await fetch('/api/transactions/category', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: transactionId,
        field: 'category',
        value: pending,
        scope,
        merchant_normalized: merchantNormalized,
        pattern: scope !== 'single' ? pattern : undefined,
        date: txDate,
      }),
    })
    const data = await res.json()

    if (data.ok) {
      const label = pending ? (PRIMARY_LABELS[pending] ?? pending) : 'Cleared'
      const scopeLabel =
        scope === 'single' ? 'this transaction' :
        scope === 'all_past' ? `all past "${pattern}"` :
        `all matching "${pattern}"`

      addUndoEntry({
        description: `Set category to "${label}" for ${scopeLabel}`,
        changes: data.oldValues,
      })

      setValue(pending ?? null)
      setPending(undefined)
      onSaved?.()
      onCategoryChange?.(pending ?? null)
    }

    setSaving(false)
  }

  const cancelScope = () => setPending(undefined)

  const displayLabel = value
    ? (PRIMARY_LABELS[value] ?? value)
    : formatCategory(plaidCategory)

  // Scope confirmation panel
  if (pending !== undefined) {
    return (
      <div className="flex flex-col gap-2 w-full mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">
            Apply &ldquo;{pending ? (PRIMARY_LABELS[pending] ?? pending) : 'clear'}&rdquo; to:
          </span>
          <button onClick={cancelScope} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">Vendor pattern:</span>
          <input
            type="text"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300 min-w-0"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['single', 'Just this'],
            ['all_past', 'All past'],
            ['all', 'All matching — now & future'],
          ] as [Scope, string][]).map(([s, label]) => (
            <button
              key={s}
              disabled={saving || (s !== 'single' && !pattern.trim())}
              onClick={() => applyScope(s)}
              className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={saving}
        onClick={openDropdown}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[200px]
          ${isOverridden
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="flex-1 text-xs focus:outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {/* Clear option */}
            {!q && value && (
              <li
                onMouseDown={() => handleSelect(null)}
                className="px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 text-gray-400 italic"
              >
                Clear override
              </li>
            )}
            {filteredPlaid.map(key => (
              <li
                key={key}
                onMouseDown={() => handleSelect(key)}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 ${value === key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                {PRIMARY_LABELS[key]}
              </li>
            ))}
            {filteredCustom.length > 0 && (
              <>
                <li className="px-3 pt-2 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide border-t border-gray-100">
                  Custom
                </li>
                {filteredCustom.map(cat => (
                  <li
                    key={cat}
                    onMouseDown={() => handleSelect(cat)}
                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 ${value === cat ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    {cat}
                  </li>
                ))}
              </>
            )}
            {showCreate && (
              <li
                onMouseDown={() => handleSelect(query.trim())}
                className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 text-blue-600 font-medium border-t border-gray-100"
              >
                Create &ldquo;{query.trim()}&rdquo;
              </li>
            )}
            {filteredPlaid.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-xs text-gray-400">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
