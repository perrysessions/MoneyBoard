import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { CategoryPicker } from '@/components/CategoryPicker'
import { SubcategoryPicker } from '@/components/SubcategoryPicker'
import { UndoBar } from '@/components/UndoBar'

import { TransactionFilters } from '@/components/TransactionFilters'
import { TransactionSplitButton } from '@/components/TransactionSplitButton'
import { ExcludeButton } from '@/components/ExcludeButton'

const fmt = (cents: number) => {
  const abs = Math.abs(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })
  return cents < 0 ? `+$${abs}` : `$${abs}`
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: {
    page?: string; search?: string; account?: string; category?: string; subcategory?: string
    dateFrom?: string; dateTo?: string; amountMin?: string; amountMax?: string
    showTransfers?: string
  }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const pageSize = 50
  const from = (page - 1) * pageSize

  const showTransfers = searchParams.showTransfers === '1'

  // Use a fixed literal select so TypeScript can infer types correctly.
  // is_excluded is selected; if the column doesn't exist yet the query errors
  // and we fall back to a second query without it.
  const SELECT = `id, date, merchant_name, merchant_normalized, amount_cents, pending,
    category, subcategory, user_category, user_subcategory, manual_override,
    is_internal_transfer,
    accounts(id, name, official_name, nickname, mask, type, subtype, institution)` as const

  const applyFilters = (q: ReturnType<typeof supabase.from<'transactions', any>>) => {
    if (!showTransfers) q = q.eq('is_internal_transfer', false)
    if (searchParams.search) q = q.ilike('merchant_name', `%${searchParams.search}%`)
    if (searchParams.account) q = q.eq('account_id', searchParams.account)
    if (searchParams.dateFrom) q = q.gte('date', searchParams.dateFrom)
    if (searchParams.dateTo) q = q.lte('date', searchParams.dateTo)
    if (searchParams.amountMin) q = q.gte('amount_cents', Math.round(parseFloat(searchParams.amountMin) * 100))
    if (searchParams.amountMax) q = q.lte('amount_cents', Math.round(parseFloat(searchParams.amountMax) * 100))
    if (searchParams.category) {
      q = q.or(`user_category.eq.${searchParams.category},and(user_category.is.null,category.eq.${searchParams.category})`)
    }
    if (searchParams.subcategory) {
      q = q.or(`user_subcategory.eq.${searchParams.subcategory},and(user_subcategory.is.null,subcategory.eq.${searchParams.subcategory})`)
    }
    return q
  }

  // Try fetching with is_excluded; fall back if column doesn't exist yet
  const baseQuery = () => applyFilters(
    supabase.from('transactions').select(SELECT, { count: 'exact' })
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
  )

  let primaryResult = await baseQuery().eq('is_excluded', false).range(from, from + pageSize - 1)
  const result = primaryResult.error
    ? await baseQuery().range(from, from + pageSize - 1)
    : primaryResult

  const transactions = result.data as any[] | null
  const count = result.count
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, official_name, nickname, mask')
    .eq('user_id', user.id)
    .order('institution')

  const hasFilters = !!(searchParams.search || searchParams.account || searchParams.category || searchParams.subcategory || searchParams.dateFrom || searchParams.dateTo || searchParams.amountMin || searchParams.amountMax || showTransfers)

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
          <span className="text-sm text-gray-400">
            {count ?? 0}{hasFilters ? ' results' : ' total'}
          </span>
        </div>

        <UndoBar />

        <TransactionFilters accounts={accounts ?? []} showTransfers={showTransfers} />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!transactions?.length ? (
            <div className="py-16 text-center text-sm text-gray-400">No transactions match your filters</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => {
                const acct = tx.accounts as any
                const isCredit = tx.amount_cents < 0
                const isInternal = tx.is_internal_transfer
                const isExcluded = (tx as any).is_excluded ?? false
                const effectivePrimaryKey = (tx.user_category ?? tx.category) as string | null

                return (
                  <div key={tx.id} className={`px-5 py-3 ${isInternal || isExcluded ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`text-sm font-medium text-gray-900 truncate ${isExcluded ? 'line-through' : ''}`}>{tx.merchant_name}</p>
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
                    <div className="flex items-start gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-400 shrink-0">{tx.date}</span>
                      {acct && <>
                        <span className="text-xs text-gray-300 shrink-0">·</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {acct.nickname ?? acct.official_name ?? acct.name}
                          {acct.mask ? ` ···${acct.mask}` : ''}
                        </span>
                      </>}
                      <span className="text-xs text-gray-300 shrink-0">·</span>
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-300 w-20 shrink-0">Category</span>
                          <CategoryPicker
                            transactionId={tx.id}
                            userCategory={tx.user_category}
                            plaidCategory={tx.category}
                            plaidSubcategory={tx.subcategory}
                            merchantName={tx.merchant_name ?? ''}
                            merchantNormalized={tx.merchant_normalized ?? tx.merchant_name ?? ''}
                            txDate={tx.date}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-300 w-20 shrink-0">Subcategory</span>
                          <SubcategoryPicker
                            transactionId={tx.id}
                            userSubcategory={tx.user_subcategory ?? null}
                            plaidSubcategory={tx.subcategory}
                            effectivePrimaryKey={effectivePrimaryKey}
                            merchantName={tx.merchant_name ?? ''}
                            merchantNormalized={tx.merchant_normalized ?? tx.merchant_name ?? ''}
                            txDate={tx.date}
                          />
                        </div>
                        {!isInternal && tx.amount_cents > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-gray-300 w-20 shrink-0"></span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <TransactionSplitButton
                                transactionId={tx.id}
                                transactionAmountCents={tx.amount_cents}
                                merchantName={tx.merchant_name ?? 'Transaction'}
                              />
                              <ExcludeButton transactionId={tx.id} isExcluded={isExcluded} />
                            </div>
                          </div>
                        )}
                      </div>
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
      
    </div>
  )
}
