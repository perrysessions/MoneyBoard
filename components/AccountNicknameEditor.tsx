'use client'

import { useState, useRef } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { getAccountDisplayName, type AccountDisplayFields } from '@/lib/accounts'

interface Props {
  account: AccountDisplayFields & { id: string }
}

export function AccountNicknameEditor({ account }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(account.nickname ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayName = getAccountDisplayName(account)

  const startEdit = () => {
    setValue(account.nickname ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => {
    setEditing(false)
    setValue(account.nickname ?? '')
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/accounts/nickname', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: account.id, nickname: value.trim() }),
    })
    setSaving(false)
    setEditing(false)
    window.location.reload()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={displayName}
          className="text-sm border border-blue-300 rounded-lg px-2 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-green-600 hover:text-green-700 p-1"
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={cancel}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-sm font-medium text-gray-900">
        {displayName}
        {account.mask && !account.nickname && (
          <span className="text-gray-400 font-normal"> ···{account.mask}</span>
        )}
      </span>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity p-0.5"
        aria-label="Edit nickname"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  )
}
