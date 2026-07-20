'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SUBCATEGORY_LABELS, getSubcategoriesForPrimary, formatCategory } from '@/lib/categories'
import { ChevronDown, X, Search } from 'lucide-react'
import { addUndoEntry } from '@/lib/undoHistory'

type Scope = 'single' | 'all_past' | 'all'

interface Props {
  transactionId: string
  userSubcategory: string | null
  plaidSubcategory: string | null
  effectivePrimaryKey: string | null
  merchantName: string
  merchantNormalized: string
  txDate: string
  onSaved?: () => void
  customSubcategories?: string[]
}

export function SubcategoryPicker({
  transactionId, userSubcategory, plaidSubcategory, effectivePrimaryKey,
  merchantName, merchantNormalized, txDate, onSaved, customSubcategories = [],
}: Props) {
  const [value, setValue] = useState<string | null>(userSubcategory)
  const [pending, setPending] = useState<string | null | undefined>(undefined)
  const [pattern, setPattern] = useState('')
  const [pattern2, setPattern2] = useState('')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const isOverridden = !!value

  // Subcategory keys scoped to the active primary category
  const subcategoryKeys = effectivePrimaryKey
    ? getSubcategoriesForPrimary(effectivePrimaryKey)
    : Object.keys(SUBCATEGORY_LABELS)

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setDropdownStyle({ top: rect.bottom + 4, left: rect.left })
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const openDropdown = () => {
    updatePosition()
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const q = query.trim().toLowerCase()

  const filteredKeys = subcategoryKeys.filter(key =>
    !q || (SUBCATEGORY_LABELS[key] ?? key).toLowerCase().includes(q)
  )

  // Deduplicate Plaid keys that map to the same display label
  const seenLabels = new Set<string>()
  const dedupedKeys = filteredKeys.filter(key => {
    const label = (SUBCATEGORY_LABELS[key] ?? key).toLowerCase()
    if (seenLabels.has(label)) return false
    seenLabels.add(label)
    return true
  })
  const filteredCustom = customSubcategories.filter(s =>
    !seenLabels.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))
  )

  // Show "Create" when query has text and doesn't match any existing label
  const exactMatch =
    subcategoryKeys.some(k => (SUBCATEGORY_LABELS[k] ?? k).toLowerCase() === q) ||
    customSubcategories.some(s => s.toLowerCase() === q)
  const showCreate = q.length > 0 && !exactMatch

  function suggestPattern(merchantNormalized: string): string {
    const m = merchantNormalized.match(/^(.*?)\s+\d/)
    return m ? m[1].trim() : merchantNormalized
  }

  const handleSelect = (newVal: string | null) => {
    setOpen(false)
    setQuery('')
    if (newVal === value) return
    setPattern(suggestPattern(merchantNormalized))
    setPattern2('')
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
        field: 'subcategory',
        value: pending,
        scope,
        merchant_normalized: merchantNormalized,
        pattern: scope !== 'single' ? pattern : undefined,
        pattern2: scope !== 'single' && pattern2.trim() ? pattern2.trim() : undefined,
        date: txDate,
      }),
    })
    const data = await res.json()

    if (data.ok) {
      const label = pending ? (SUBCATEGORY_LABELS[pending] ?? pending) : 'Cleared'
      const scopeLabel =
        scope === 'single' ? 'this transaction' :
        scope === 'all_past' ? `all past "${pattern}"` :
        `all matching "${pattern}"`

      addUndoEntry({
        description: `Set subcategory to "${label}" for ${scopeLabel}`,
        changes: data.oldValues,
      })

      setValue(pending ?? null)
      setPending(undefined)
      onSaved?.()
    }

    setSaving(false)
  }

  const cancelScope = () => setPending(undefined)

  const displayLabel = value
    ? (SUBCATEGORY_LABELS[value] ?? value)
    : (plaidSubcategory ? (SUBCATEGORY_LABELS[plaidSubcategory] ?? formatCategory(plaidSubcategory)) : 'Subcategory')

  // Scope confirmation panel
  if (pending !== undefined) {
    return (
      <div className="flex flex-col gap-2 w-full mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">
            Apply &ldquo;{pending ? (SUBCATEGORY_LABELS[pending] ?? pending) : 'clear'}&rdquo; subcategory to:
          </span>
          <button onClick={cancelScope} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">Contains:</span>
          <input
            type="text"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-300 min-w-0"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 shrink-0">And also:</span>
          <input
            type="text"
            placeholder="optional second phrase"
            value={pattern2}
            onChange={e => setPattern2(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-300 min-w-0 placeholder-gray-300"
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
              className="text-xs px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
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
        ref={buttonRef}
        type="button"
        disabled={saving}
        onClick={openDropdown}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-400 max-w-[200px]
          ${isOverridden
            ? 'bg-purple-50 border-purple-200 text-purple-700'
            : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownStyle.top, left: dropdownStyle.left, zIndex: 9999 }}
          className="w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search subcategories…"
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
            {dedupedKeys.map(key => (
              <li
                key={key}
                onMouseDown={() => handleSelect(key)}
                className={`px-3 py-2 text-xs cursor-pointer hover:bg-purple-50 ${value === key ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'}`}
              >
                {SUBCATEGORY_LABELS[key] ?? key}
              </li>
            ))}
            {filteredCustom.length > 0 && (
              <>
                <li className="px-3 pt-2 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide border-t border-gray-100">
                  Custom
                </li>
                {filteredCustom.map(s => (
                  <li
                    key={s}
                    onMouseDown={() => handleSelect(s)}
                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-purple-50 ${value === s ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'}`}
                  >
                    {s}
                  </li>
                ))}
              </>
            )}
            {showCreate && (
              <li
                onMouseDown={() => handleSelect(query.trim())}
                className="px-3 py-2 text-xs cursor-pointer hover:bg-purple-50 text-purple-600 font-medium border-t border-gray-100"
              >
                Create &ldquo;{query.trim()}&rdquo;
              </li>
            )}
            {filteredKeys.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-xs text-gray-400">No results</li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
