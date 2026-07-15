'use client'

import { useState } from 'react'
import { Scissors, X, Check, ChevronDown } from 'lucide-react'
import { PRIMARY_LABELS, SUBCATEGORY_LABELS, PLAID_PRIMARY_CATEGORIES, getSubcategoriesForPrimary } from '@/lib/categories'

interface Props {
  transactionId: string
  transactionAmountCents: number
  merchantName: string
}

const fmt = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })

export function TransactionSplitButton({ transactionId, transactionAmountCents, merchantName }: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [amountDollars, setAmountDollars] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [customSubcategory, setCustomSubcategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustomCat = category === '__custom__'
  const effectiveCategory = isCustomCat ? customCategory.trim() : category
  const subcategoryOptions = (!isCustomCat && category) ? getSubcategoriesForPrimary(category) : []
  const isCustomSub = subcategory === '__custom__'
  const effectiveSubcategory = isCustomSub ? customSubcategory.trim() : subcategory

  const handleAdd = async () => {
    const dollars = parseFloat(amountDollars)
    if (!label.trim()) { setError('Label required'); return }
    if (isNaN(dollars) || dollars <= 0) { setError('Enter a valid amount'); return }
    const amount_cents = Math.round(dollars * 100)
    if (amount_cents >= transactionAmountCents) {
      setError(`Split must be less than ${fmt(transactionAmountCents)}`)
      return
    }
    setError(null)
    setSaving(true)

    const res = await fetch(`/api/transactions/${transactionId}/splits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: label.trim(),
        amount_cents,
        category: effectiveCategory || null,
        subcategory: effectiveSubcategory || null,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (data.error) { setError(data.error); return }
    window.location.reload()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 transition-colors"
      >
        <Scissors className="h-3 w-3" />
        Split
      </button>
    )
  }

  return (
    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-2 w-full mt-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-orange-800">Split from: {merchantName} ({fmt(transactionAmountCents)} remaining)</span>
        <button onClick={() => { setOpen(false); setError(null) }} className="text-orange-400 hover:text-orange-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Label (e.g. Entertainment)"
        className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
      />

      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amountDollars}
          onChange={e => setAmountDollars(e.target.value)}
          placeholder="Amount"
          className="w-full text-xs pl-6 pr-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {/* Category */}
      <div className="relative">
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setSubcategory(''); setCustomCategory(''); setCustomSubcategory('') }}
          className="w-full text-xs px-2.5 py-1.5 pr-7 border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
        >
          <option value="">Category (optional)</option>
          {PLAID_PRIMARY_CATEGORIES.map(k => (
            <option key={k} value={k}>{PRIMARY_LABELS[k]}</option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
      </div>

      {isCustomCat && (
        <input
          type="text"
          value={customCategory}
          onChange={e => setCustomCategory(e.target.value)}
          placeholder="Custom category name"
          className="w-full text-xs px-2.5 py-1.5 border border-orange-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      )}

      {/* Subcategory — Plaid options when Plaid category selected */}
      {subcategoryOptions.length > 0 && (
        <div className="relative">
          <select
            value={subcategory}
            onChange={e => setSubcategory(e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 pr-7 border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
          >
            <option value="">Subcategory (optional)</option>
            {subcategoryOptions.map(k => (
              <option key={k} value={k}>{SUBCATEGORY_LABELS[k]}</option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* Custom subcategory text input — for custom category or when "Custom…" picked */}
      {(isCustomCat || isCustomSub) && (
        <input
          type="text"
          value={customSubcategory}
          onChange={e => setCustomSubcategory(e.target.value)}
          placeholder="Custom subcategory (optional)"
          className="w-full text-xs px-2.5 py-1.5 border border-orange-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          <Check className="h-3 w-3" />
          {saving ? 'Saving…' : 'Add Split'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null) }}
          className="px-3 py-1.5 border border-gray-200 text-xs text-gray-500 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
