'use client'

import { useState } from 'react'

interface Props {
  name: string
  className?: string
}

export function MerchantName({ name, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  return (
    <span className="min-w-0 flex-1">
      <p
        onClick={() => setExpanded(v => !v)}
        className={`${className} truncate cursor-pointer`}
      >
        {name}
      </p>
      {expanded && (
        <p className="text-xs text-gray-500 break-all mt-0.5 cursor-pointer" onClick={() => setExpanded(false)}>
          {name}
        </p>
      )}
    </span>
  )
}
