'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { CATEGORIES } from '@/lib/gemini/categorize'

type Account = { id: string; name: string; official_name: string | null; nickname: string | null; mask: string | null }

export function TransactionFilters({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [open, setOpen] = useState(false)

  const get = (key: string) => sp.get(key) ?? ''

  const push = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(sp.toString())
    params.delete('page') // reset to page 1 on filter change
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [sp, router, pathname])

  const activeCount = ['search', 'account', 'category', 'dateFrom', 'dateTo', 'amountMin', 'amountMax']
    .filter(k => sp.has(k)).length

  const clearAll = () => {
    router.push(pathname)
    setOpen(false)
  }

  return (
    <div className="mb-4 space-y-2">
      {/* Search bar + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendor…"
            defaultValue={get('search')}
            onChange={e => push({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors ${
            activeCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl bg-white">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {open && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Account */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
            <select
              value={get('account')}
              onChange={e => push({ account: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nickname ?? a.official_name ?? a.name}{a.mask ? ` ···${a.mask}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={get('category')}
              onChange={e => push({ category: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date from</label>
            <input
              type="date"
              value={get('dateFrom')}
              onChange={e => push({ dateFrom: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date to</label>
            <input
              type="date"
              value={get('dateTo')}
              onChange={e => push({ dateTo: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amount min */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={get('amountMin')}
              onChange={e => push({ amountMin: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amount max */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="any"
              defaultValue={get('amountMax')}
              onChange={e => push({ amountMax: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}
