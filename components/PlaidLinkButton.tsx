'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)

  // Preload token on mount so open() fires synchronously on click
  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then(r => r.json())
      .then(d => setLinkToken(d.link_token))
  }, [])

  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    await fetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_token,
        institution_id: metadata.institution?.institution_id,
        institution_name: metadata.institution?.name,
      }),
    })
    window.location.reload()
  }, [])

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess })

  return (
    <Button
      onClick={() => open()}
      disabled={!ready}
      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
    >
      {!ready ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
      Connect Bank
    </Button>
  )
}
