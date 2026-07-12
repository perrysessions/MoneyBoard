import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { DollarSign, LogOut, ArrowLeft } from 'lucide-react'
import { CategoryPicker } from '@/components/CategoryPicker'
import { CategorizeButton } from '@/components/CategorizeButton'
import { BottomNav } from '@/components/BottomNav'
import { TransactionFilters } from '@/components/TransactionFilters'

const fmt = (cents: number) => {
  const abs = Math.abs(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
  return cents < 0 ? `+$${abs}` : `$${abs}`
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; account?: string; category?: string; dateFrom?: string; dateTo?: string; amountMin?: string; amountMax?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const pageSize = 50
  const from = (page - 1) * pageSize

  // Build filtered query
  let query = supabase
    .from('transactions')
    .select(`
      id, date, merchant_name, amount_cents, pending,
      ai_category, user_category, manual_override, is_internal_transfer,
      accounts(id, name, official_name, nickname, mask, type, subtype, institution)
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (searchParams.search) query = query.ilike('merchant_name', `%${searchParams.search}%`)
  if (searchParams.account) query = query.eq('account_id', searchParams.account)
  if (searchParams.dateFrom) query = query.gte('date', searchParams.dateFrom)
  if (searchParams.dateTo) query = query.lte('date', searchParams.dateTo)
  if (searchParams.amountMin) query = query.gte('amount_cents', Math.round(parseFloat(searchParams.amountMin) * 100))
  if (searchParams.amountMax) query = query.lte('amount_cents', Math.round(parseFloat(searchParams.amountMax) * 100))
  if (searchParams.category) {
    query = query.or(`user_category.eq.${searchParams.category},and(user_category.is.null,ai_category.eq.${searchParams.category})`)
  }

  const { data: transactions, count } = await query.range(from, from + pageSize - 1)
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const { count: uncategorized } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('ai_category', null)

  // Accounts for filter dropdown
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, official_name, nickname, mask')
    .eq('user_id', user.id)
    .order('institution')

  const hasFilters = !!(searchParams.search || searchParams.account || searchParams.category || searchParams.dateFrom || searchParams.dateTo || searchParams.amountMin || searchParams.amountMax)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
            <span className="text-sm text-gray-400">
              {count ?? 0}{hasFilters ? ' results' : ' total'}
            </span>
          </div>
          <CategorizeButton uncategorized={uncategorized ?? 0} />
        </div>

        <TransactionFilters accounts={accounts ?? []} />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!transactions?.length ? (
            <div className="py-16 text-center text-sm text-gray-400">No transactions match your filters</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => {
                const acct = tx.accounts as any
                const isCredit = tx.amount_cents < 0
                const isInternal = tx.is_internal_transfer

                return (
                  <div key={tx.id} className={`px-5 py-3 ${isInternal ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.merchant_name}</p>
                        {tx.pending && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Pending</span>
                        )}
                        {isInternal && (
                          <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full shrink-0">Transfer</span>
                        )}
                      </div>
                      <p className={`text-sm font-semibold tabular-nums shrink-0 ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>
                        {fmt(tx.amount_cents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-400">{tx.date}</span>
                      {acct && <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                          {acct.nickname ?? acct.official_name ?? acct.name}
                          {acct.mask ? ` ···${acct.mask}` : ''}
                        </span>
                      </>}
                      <span className="text-xs text-gray-300">·</span>
                      <CategoryPicker
                        transactionId={tx.id}
                        current={tx.user_category}
                        aiCategory={tx.ai_category}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {page > 1 && (
              <Link href={`/dashboard/transactions?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([k]) => k !== 'page')), page: String(page - 1) })}`}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link href={`/dashboard/transactions?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([k,v]) => v)), page: String(page + 1) })}`}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
