import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, CreditCard, LogOut, Landmark } from 'lucide-react'
import Link from 'next/link'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'
import { SyncButton } from '@/components/SyncButton'
import { AccountNicknameEditor } from '@/components/AccountNicknameEditor'
import { BottomNav } from '@/components/BottomNav'

const fmt = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10)

  // Accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, official_name, mask, nickname, institution, type, subtype')
    .eq('user_id', user.id)
    .order('institution')

  // All non-pending, non-internal outgoing transactions this month with account info
  const { data: txData } = await supabase
    .from('transactions')
    .select('amount_cents, category, account_id, accounts(type, subtype)')
    .eq('user_id', user.id)
    .eq('pending', false)
    .eq('is_internal_transfer', false)
    .gt('amount_cents', 0)
    .gte('date', firstOfMonth)

  const allTx = txData ?? []

  // Total spend = everything going out (no internal transfers)
  const totalSpend = allTx.reduce((s, t) => s + t.amount_cents, 0)

  // Credit card spend = transactions on credit accounts
  const ccSpend = allTx
    .filter((t: any) => t.accounts?.type === 'credit')
    .reduce((s, t) => s + t.amount_cents, 0)

  // Cash out = money leaving checking/savings to the outside world
  const cashOut = allTx
    .filter((t: any) => t.accounts?.type === 'depository')
    .reduce((s, t) => s + t.amount_cents, 0)

  // Transaction count
  const { count: txCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Nav */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 text-white rounded-lg p-1.5">
            <DollarSign className="h-4 w-4" />
          </div>
          <span className="font-semibold text-gray-900 text-base">Money Board</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-gray-400">{user.email}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit" className="text-gray-400 hover:text-gray-600 px-2">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </h1>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Total Spend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Spend</span>
              <TrendingUp className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{totalSpend > 0 ? fmt(totalSpend) : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">All outflows this month</p>
          </div>

          {/* Credit Card Spend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Credit Cards</span>
              <CreditCard className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{ccSpend > 0 ? fmt(ccSpend) : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Charges on cards</p>
          </div>

          {/* Cash Out */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cash Out</span>
              <Landmark className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{cashOut > 0 ? fmt(cashOut) : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">From checking / savings</p>
          </div>
        </div>

        {/* Transactions link row */}
        <Link href="/dashboard/transactions" className="block mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Transactions</p>
                <p className="text-2xl font-semibold text-gray-900">{txCount ?? 0}</p>
              </div>
              <span className="text-sm text-blue-600 font-medium">View all →</span>
            </div>
          </div>
        </Link>

        {/* Bank connections */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Connected Banks</h2>
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
      <BottomNav />
    </div>
  )
}
