import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'

import { PlaidLinkButton } from '@/components/PlaidLinkButton'
import { SyncButton } from '@/components/SyncButton'
import { AccountNicknameEditor } from '@/components/AccountNicknameEditor'

export default async function BanksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, official_name, mask, nickname, institution, type, subtype')
    .eq('user_id', user.id)
    .order('institution')

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Connected Banks</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Your Accounts</h2>
            <div className="flex items-center gap-2">
              {(accounts?.length ?? 0) > 0 && <SyncButton />}
              <PlaidLinkButton />
            </div>
          </div>

          {!accounts?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-50 rounded-full p-4 mb-4">
                <CreditCard className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No banks connected yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Connect Bank" to link Chase or Wells Fargo</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {accounts.map(account => (
                <div key={account.id} className="flex items-center gap-3 py-3">
                  <div className="bg-blue-50 rounded-lg p-2 shrink-0">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <AccountNicknameEditor account={account} />
                    <p className="text-xs text-gray-400">
                      {account.institution} · {account.subtype ?? account.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      
    </div>
  )
}
