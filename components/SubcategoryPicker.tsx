'use client'

import { useState, useRef } from 'react'
import { SUBCATEGORY_LABELS, getSubcategoriesForPrimary, formatCategory } from '@/lib/categories'
import { ChevronDown, X, Check } from 'lucide-react'
import { addUndoEntry } from '@/lib/undoHistory'

type Scope = 'single' | 'this_and_future' | 'all_past' | 'all'

interface Props {
  transactionId: string
  userSubcategory: string | null
  plaidSubcategory: string | null
  effectivePrimaryKey: string | null
  merchantName: string
  merchantNormalized: string
  txDate: string
  onSaved?: () => void
}

export function SubcategoryPicker({
  transactionId, userSubcategory, plaidSubcategory, effectivePrimaryKey,
  merchantName, merchantNormalized, txDate, onSaved,
}: Props) {
  const [value, setValue] = useState<string | null>(userSubcategory)
  const [pending, setPending] = useState<string | null | undefined>(undefined)
  const [showCustom, setShowCustom] = useState(false)
  const [customText, setCustomText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isOverridden = !!value

  const subcategoryKeys = effectivePrimaryKey
    ? getSubcategoriesForPrimary(effectivePrimaryKey)
    : Object.keys(SUBCATEGORY_LABELS)

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value
    if (newVal === '__custom__') {
      setShowCustom(true)
      setCustomText('')
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    const resolved = newVal || null
    if (resolved === value) return
    setPending(resolved)
  }

  const confirmCustom = () => {
    const trimmed = customText.trim()
    if (!trimmed) return
    setShowCustom(false)
    setPending(trimmed)
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
        date: txDate,
      }),
    })
    const data = await res.json()

    if (data.ok) {
      const label = pending ? (SUBCATEGORY_LABELS[pending] ?? pending) : 'Cleared'
      const scopeLabel =
        scope === 'single' ? 'this transaction' :
        scope === 'this_and_future' ? `this + future ${merchantName}` :
        scope === 'all_past' ? `all past ${merchantName}` :
        `all ${merchantName}`

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

  // Custom text input mode
  if (showCustom) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') confirmCustom()
            if (e.key === 'Escape') setShowCustom(false)
          }}
          placeholder="Subcategory name…"
          className="text-xs px-2 py-0.5 rounded-full border border-purple-300 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 w-36"
        />
        <button onClick={confirmCustom} className="text-green-600 hover:text-green-700">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={() => setShowCustom(false)} className="text-gray-400 hover:text-gray-600">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  // Scope panel
  if (pending !== undefined) {
    return (
      <div className="flex flex-col gap-1.5 w-full mt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500">
            Apply &ldquo;{pending ? (SUBCATEGORY_LABELS[pending] ?? pending) : 'clear'}&rdquo; subcategory to:
          </span>
          <button onClick={cancelScope} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['single', 'Just this'],
            ['this_and_future', `This + future ${merchantName}`],
            ['all_past', `All past ${merchantName}`],
            ['all', `All ${merchantName}`],
          ] as [Scope, string][]).map(([s, label]) => (
            <button
              key={s}
              disabled={saving}
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

  const selectEl = (keys: string[]) => (
    <div className="relative inline-flex items-center">
      <select
        value={value ?? ''}
        onChange={handleSelect}
        disabled={saving}
        title={isOverridden ? 'You set this subcategory' : 'Override subcategory'}
        className={`text-xs pr-5 pl-2 py-0.5 rounded-full border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-400
          ${isOverridden
            ? 'bg-purple-50 border-purple-200 text-purple-700'
            : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
      >
        <option value="">{plaidSubcategory ? (SUBCATEGORY_LABELS[plaidSubcategory] ?? formatCategory(plaidSubcategory)) : 'Subcategory'}</option>
        {keys.map(key => (
          <option key={key} value={key}>{SUBCATEGORY_LABELS[key]}</option>
        ))}
        {value && !SUBCATEGORY_LABELS[value] && (
          <option value={value}>{value}</option>
        )}
        <option disabled>──────────</option>
        <option value="__custom__">✏ Custom…</option>
      </select>
      <ChevronDown className="absolute right-1 h-3 w-3 text-gray-400 pointer-events-none" />
    </div>
  )

  if (!subcategoryKeys.length) {
    // Custom primary category — show minimal picker so user can set a custom subcategory
    return selectEl([])
  }

  return selectEl(subcategoryKeys)
}
