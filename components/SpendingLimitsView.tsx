'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, X, Check, ChevronDown, Search } from 'lucide-react'
import { PLAID_PRIMARY_CATEGORIES, PRIMARY_LABELS, SUBCATEGORY_LABELS } from '@/lib/categories'

// All subcategories as [{key, label, group}], grouped by primary display name
const ALL_SUBCATEGORIES = Object.entries(SUBCATEGORY_LABELS)
  .map(([key, label]) => {
    const primaryKey = PLAID_PRIMARY_CATEGORIES.find(p => key.startsWith(p + '_')) ?? ''
    return { key, label, group: PRIMARY_LABELS[primaryKey] ?? primaryKey }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

function SubcategorySearch({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const display = value ? (SUBCATEGORY_LABELS[value] ?? value) : ''

  const q = query.trim().toLowerCase()
  const filtered = q
    ? ALL_SUBCATEGORIES.filter(s =>
        s.label.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q) ||
        s.key.toLowerCase().replace(/_/g, ' ').includes(q)
      )
    : ALL_SUBCATEGORIES

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="w-full h-10 px-3 pr-8 text-sm border border-gray-200 rounded-xl bg-white flex items-center text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`flex-1 ${display ? 'text-gray-900' : 'text-gray-400'}`}>
          {display || 'Select subcategory…'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search subcategories…"
              className="flex-1 text-sm focus:outline-none bg-transparent"
            />
            {query && <button onClick={() => setQuery('')}><X className="h-3.5 w-3.5 text-gray-400" /></button>}
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No results</li>
            )}
            {filtered.map(s => (
              <li
                key={s.key}
                onMouseDown={() => { onChange(s.key); setOpen(false); setQuery('') }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between gap-2
                  ${s.key === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                <span>{s.label}</span>
                <span className="text-xs text-gray-400 shrink-0">{s.group}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export interface LimitRow {
  id: string
  label: string
  category: string | null
  subcategory: string | null
  merchant_normalized: string | null
  monthly_limit_cents: number
  active: boolean
  spent_cents: number
}

interface FormState {
  label: string
  type: 'category' | 'subcategory' | 'merchant'
  category: string
  subcategory: string
  merchant_normalized: string
  monthly_limit_dollars: string
}

const emptyForm = (): FormState => ({
  label: '',
  type: 'category',
  category: 'FOOD_AND_DRINK',
  subcategory: '',
  merchant_normalized: '',
  monthly_limit_dollars: '',
})

const fmt = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function ProgressBar({ spent, limit }: { spent: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const color = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-400' : 'bg-green-500'
  const textColor = pct >= 100 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-green-600'
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">{fmt(spent)} spent</span>
        <span className={`text-xs font-semibold ${textColor}`}>{pct}% of {fmt(limit)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {spent > limit && (
        <p className="text-xs text-red-500 mt-1">{fmt(spent - limit)} over limit</p>
      )}
    </div>
  )
}

interface LimitFormProps {
  initialForm?: FormState
  merchants: string[]
  customCategories: string[]
  saving: boolean
  onSubmit: (form: FormState) => void
  onCancel: () => void
  submitLabel: string
}

function LimitForm({ initialForm, merchants, customCategories, saving, onSubmit, onCancel, submitLabel }: LimitFormProps) {
  const [form, setForm] = useState<FormState>(initialForm ?? emptyForm())
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
        <input
          type="text"
          value={form.label}
          onChange={e => set('label', e.target.value)}
          placeholder="e.g. Dining Budget"
          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Limit type</label>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium bg-white">
          {(['category', 'subcategory', 'merchant'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={`flex-1 py-2 transition-colors text-xs ${form.type === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {t === 'category' ? 'Category' : t === 'subcategory' ? 'Subcategory' : 'Merchant'}
            </button>
          ))}
        </div>
      </div>

      {form.type === 'category' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <div className="relative">
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full h-10 pl-3 pr-8 text-sm border border-gray-200 rounded-xl bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLAID_PRIMARY_CATEGORIES.map(key => (
                <option key={key} value={key}>{PRIMARY_LABELS[key]}</option>
              ))}
              {customCategories.length > 0 && (
                <optgroup label="Custom">
                  {customCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {form.type === 'subcategory' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Subcategory</label>
          <SubcategorySearch value={form.subcategory} onChange={v => set('subcategory', v)} />
        </div>
      )}

      {form.type === 'merchant' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Merchant name</label>
          <input
            type="text"
            list="merchant-suggestions"
            value={form.merchant_normalized}
            onChange={e => set('merchant_normalized', e.target.value)}
            placeholder="e.g. starbucks"
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="merchant-suggestions">
            {merchants.map(m => <option key={m} value={m} />)}
          </datalist>
          <p className="text-xs text-gray-400 mt-1">Use the normalized name as shown in Transactions</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Monthly limit</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.monthly_limit_dollars}
            onChange={e => set('monthly_limit_dollars', e.target.value)}
            placeholder="500"
            className="w-full h-10 pl-7 pr-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={saving}
          className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 border border-gray-200 text-sm text-gray-500 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function SpendingLimitsView({
  initialLimits,
  merchants,
  customCategories,
}: {
  initialLimits: LimitRow[]
  merchants: string[]
  customCategories: string[]
}) {
  const [limits, setLimits] = useState<LimitRow[]>(initialLimits)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (form: FormState) => {
    const dollars = parseFloat(form.monthly_limit_dollars)
    if (!form.label.trim() || isNaN(dollars) || dollars <= 0) {
      setError('Please fill in all fields'); return
    }
    if (form.type === 'merchant' && !form.merchant_normalized.trim()) {
      setError('Merchant name required'); return
    }
    if (form.type === 'subcategory' && !form.subcategory) {
      setError('Subcategory required'); return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          category: form.type === 'category' ? form.category : null,
          subcategory: form.type === 'subcategory' ? form.subcategory : null,
          merchant_normalized: form.type === 'merchant' ? form.merchant_normalized : null,
          monthly_limit_cents: Math.round(dollars * 100),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = `Server error (${res.status})`
        try { msg = JSON.parse(text).error ?? msg } catch {}
        setError(msg)
        setSaving(false)
        return
      }
      const data = await res.json()
      setSaving(false)
      if (data.error) { setError(data.error); return }
      window.location.reload()
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
      setSaving(false)
    }
  }

  const handleEdit = async (form: FormState) => {
    if (!editingId) return
    const dollars = parseFloat(form.monthly_limit_dollars)
    if (!form.label.trim() || isNaN(dollars) || dollars <= 0) {
      setError('Please fill in all fields'); return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/limits/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          category: form.type === 'category' ? form.category : null,
          subcategory: form.type === 'subcategory' ? form.subcategory : null,
          merchant_normalized: form.type === 'merchant' ? form.merchant_normalized : null,
          monthly_limit_cents: Math.round(dollars * 100),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = `Server error (${res.status})`
        try { msg = JSON.parse(text).error ?? msg } catch {}
        setError(msg)
        setSaving(false)
        return
      }
      const data = await res.json()
      setSaving(false)
      if (data.error) { setError(data.error); return }
      window.location.reload()
    } catch (e: any) {
      setError(e?.message ?? 'Network error')
      setSaving(false)
    }
  }

  const handleToggleActive = async (limit: LimitRow) => {
    const res = await fetch(`/api/limits/${limit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !limit.active }),
    })
    const data = await res.json()
    if (!data.error) setLimits(prev => prev.map(l => l.id === limit.id ? { ...l, active: !l.active } : l))
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/limits/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) setLimits(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  const getEditForm = (limit: LimitRow): FormState => ({
    label: limit.label,
    type: limit.merchant_normalized ? 'merchant' : limit.subcategory ? 'subcategory' : 'category',
    category: limit.category ?? 'FOOD_AND_DRINK',
    subcategory: limit.subcategory ?? '',
    merchant_normalized: limit.merchant_normalized ?? '',
    monthly_limit_dollars: (limit.monthly_limit_cents / 100).toFixed(0),
  })

  const active = limits.filter(l => l.active)
  const inactive = limits.filter(l => !l.active)

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Add button / form */}
      {showAdd ? (
        <LimitForm
          merchants={merchants}
          customCategories={customCategories}
          saving={saving}
          onSubmit={handleAdd}
          onCancel={() => { setShowAdd(false); setError(null) }}
          submitLabel="Add Limit"
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add spending limit
        </button>
      )}

      {/* Active limits */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map(limit => (
            <div key={limit.id}>
              {editingId === limit.id ? (
                <LimitForm
                  initialForm={getEditForm(limit)}
                  merchants={merchants}
                  customCategories={customCategories}
                  saving={saving}
                  onSubmit={handleEdit}
                  onCancel={() => { setEditingId(null); setError(null) }}
                  submitLabel="Save Changes"
                />
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{limit.label}</p>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {limit.merchant_normalized && (
                          <p className="text-xs text-gray-400">
                            Merchant:{' '}
                            <Link href={`/dashboard/transactions?search=${encodeURIComponent(limit.merchant_normalized)}`} className="text-blue-500 hover:underline">
                              {limit.merchant_normalized}
                            </Link>
                          </p>
                        )}
                        {limit.category && (
                          <p className="text-xs text-gray-400">
                            Category:{' '}
                            <Link href={`/dashboard/transactions?category=${encodeURIComponent(limit.category)}`} className="text-blue-500 hover:underline">
                              {PRIMARY_LABELS[limit.category] ?? limit.category}
                            </Link>
                          </p>
                        )}
                        {limit.subcategory && (
                          <p className="text-xs text-gray-400">
                            Subcategory:{' '}
                            <Link href={`/dashboard/transactions?subcategory=${encodeURIComponent(limit.subcategory)}`} className="text-blue-500 hover:underline">
                              {SUBCATEGORY_LABELS[limit.subcategory] ?? limit.subcategory}
                            </Link>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingId(limit.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deletingId === limit.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(limit.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(limit.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <ProgressBar spent={limit.spent_cents} limit={limit.monthly_limit_cents} />
                  <button
                    onClick={() => handleToggleActive(limit)}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Pause limit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!showAdd && active.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No active spending limits yet</p>
      )}

      {/* Paused limits */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Paused</p>
          <div className="space-y-2">
            {inactive.map(limit => (
              <div key={limit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{limit.label}</p>
                    <div className="flex flex-wrap items-center gap-x-1 text-xs text-gray-400">
                      {limit.merchant_normalized && (
                        <span>Merchant: <Link href={`/dashboard/transactions?search=${encodeURIComponent(limit.merchant_normalized)}`} className="text-blue-400 hover:underline">{limit.merchant_normalized}</Link></span>
                      )}
                      {limit.category && (
                        <span>Category: <Link href={`/dashboard/transactions?category=${encodeURIComponent(limit.category)}`} className="text-blue-400 hover:underline">{PRIMARY_LABELS[limit.category] ?? limit.category}</Link></span>
                      )}
                      {limit.subcategory && (
                        <span>Subcategory: <Link href={`/dashboard/transactions?subcategory=${encodeURIComponent(limit.subcategory)}`} className="text-blue-400 hover:underline">{SUBCATEGORY_LABELS[limit.subcategory] ?? limit.subcategory}</Link></span>
                      )}
                      <span>· {fmt(limit.monthly_limit_cents)}/mo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(limit)}
                      className="px-2.5 py-1 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleDelete(limit.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
