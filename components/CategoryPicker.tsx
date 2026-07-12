'use client'

import { useState } from 'react'
import { CATEGORIES, type Category } from '@/lib/gemini/categorize'
import { ChevronDown } from 'lucide-react'

interface Props {
  transactionId: string
  current: string | null
  aiCategory: string | null
}

export function CategoryPicker({ transactionId, current, aiCategory }: Props) {
  const [value, setValue] = useState<string | null>(current)
  const [saving, setSaving] = useState(false)

  const display = value ?? aiCategory ?? 'Uncategorized'
  const isOverridden = !!current

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value || null
    setSaving(true)
    setValue(newVal)
    await fetch('/api/transactions/category', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: transactionId, user_category: newVal }),
    })
    setSaving(false)
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value ?? ''}
        onChange={handleChange}
        disabled={saving}
        className={`text-xs pr-5 pl-2 py-0.5 rounded-full border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400
          ${isOverridden
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
      >
        <option value="">{aiCategory ?? 'Uncategorized'}</option>
        {CATEGORIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1 h-3 w-3 text-gray-400 pointer-events-none" />
    </div>
  )
}
