'use client'

import { useState, useEffect } from 'react'
import { Scissors, X, Check, Trash2, ChevronDown, Plus } from 'lucide-react'
import { PRIMARY_LABELS, SUBCATEGORY_LABELS, PLAID_PRIMARY_CATEGORIES, getSubcategoriesForPrimary } from '@/lib/categories'

interface Split {
  id: string
  label: string
  amount_cents: number
  category: string | null
  subcategory: string | null
}

interface Props {
  transactionId: string
  transactionAmountCents: number
  merchantName: string
}

const fmt = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })

export function TransactionSplitButton({ transactionId, transactionAmountCents, merchantName }: Props) {
  const [splits, setSplits] = useState<Split[]>([])
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [amountDollars, setAmountDollars] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const loadSplits = async () => {
    const res = await fetch(`/api/transactions/${transactionId}/splits`)
    const data = await res.json()
    if (!data.error) { setSplits(data); setLoaded(true) }
  }

  useEffect(() => {
    if (open && !loaded) loadSplits()
  }, [open])

  const subcategoryOptions = category ? getSubcategoriesForPrimary(category) : []

  const handleAdd = async () => {
    const dollars = parseFloat(amountDollars)
    if (!label.trim()) { setError('Label required'); return }
    if (isNaN(dollars) || dollars <= 0) { setError('Enter a valid amount'); return }
    const amount_cents = Math.round(dollars * 100)
    if (amount_cents > transactionAmountCents) { setError(`Can't exceed transaction total (${fmt(transactionAmountCents)})`); return }
    setError(null)
    setSaving(true)
    const res = await fetch(`/api/transactions/${transactionId}/splits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), amount_cents, category: category || null, subcategory: subcategory || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }
    setSplits(prev => [...prev, data])
    setLabel(''); setAmountDollars(''); setCategory(''); setSubcategory('')
    setShowForm(false)
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/transactions/splits/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) setSplits(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  const splitTotal = splits.reduce((s, sp) => s + sp.amount_cents, 0)
  const remainder = transactionAmountCents - splitTotal

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
          splits.length > 0 || open
            ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
        }`}
      >
        <Scissors className="h-3 w-3" />
        {splits.length > 0 ? `${splits.length} split${splits.length > 1 ? 's' : ''}` : 'Split'}
      </button>

      {open && (
        <div className="mt-2 bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-orange-800">Split: {merchantName}</span>
            <button onClick={() => setOpen(false)} className="text-orange-400 hover:text-orange-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-xs text-orange-700 flex justify-between">
            <span>Total: {fmt(transactionAmountCents)}</span>
            {splitTotal > 0 && <span>Unallocated: {fmt(remainder)}</span>}
          </div>

          {/* Existing splits */}
          {splits.map(sp => (
            <div key={sp.id} className="bg-white rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{sp.label}</p>
                <p className="text-xs text-gray-400">
                  {sp.category ? (PRIMARY_LABELS[sp.category] ?? sp.category) : ''}
                  {sp.subcategory ? ` · ${SUBCATEGORY_LABELS[sp.subcategory] ?? sp.subcategory}` : ''}
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-700 tabular-nums shrink-0">{fmt(sp.amount_cents)}</span>
              {deletingId === sp.id ? (
                <div className="flex gap-1">
                  <button onClick={() => handleDelete(sp.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Del</button>
                  <button onClick={() => setDeletingId(null)} className="text-xs text-gray-400">✕</button>
                </div>
              ) : (
                <button onClick={() => setDeletingId(sp.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add split form */}
          {showForm ? (
            <div className="bg-white rounded-lg p-3 space-y-2">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Label (e.g. Fun Money)"
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
              <div className="relative">
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value); setSubcategory('') }}
                  className="w-full text-xs px-2.5 py-1.5 pr-7 border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                >
                  <option value="">Category (optional)</option>
                  {PLAID_PRIMARY_CATEGORIES.map(k => (
                    <option key={k} value={k}>{PRIMARY_LABELS[k]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
              </div>
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
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                </div>
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
                  onClick={() => { setShowForm(false); setError(null) }}
                  className="px-3 py-1.5 border border-gray-200 text-xs text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 w-full text-xs text-orange-600 hover:text-orange-700 py-1 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add split
            </button>
          )}
        </div>
      )}
    </div>
  )
}
