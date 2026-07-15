import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Scissors } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { MergeSplitsButton } from '@/components/MergeSplitsButton'
import { CategorySubcategoryPickers } from '@/components/CategorySubcategoryPickers'
import { UndoBar } from '@/components/UndoBar'

import { TransactionFilters } from '@/components/TransactionFilters'
import { SyncButton } from '@/components/SyncButton'
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
    showTransfers?: string; showExcluded?: string; txType?: string
  }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = Math.max(1, parseInt(searchParams.page ?? '1'))
  const pageSize = 50
  const from = (page - 1) * pageSize

  const showTransfers = searchParams.showTransfers === '1'
  const showExcluded = searchParams.showExcluded === '1'

  const makeQuery = (withExcluded: boolean, withRawName: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from('transactions')
      .select(
        `id, date, merchant_name, merchant_normalized, ${withRawName ? 'raw_name, ' : ''}amount_cents, pending,
         category, subcategory, user_category, user_subcategory, manual_override,
         is_internal_transfer, is_excluded, has_splits, is_split, split_from_id, original_amount_cents,
         accounts(id, name, official_name, nickname, mask, type, subtype, institution)`,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
    if (withExcluded && !showExcluded) q = q.eq('is_excluded', false)
    if (!showTransfers) {
      q = q.eq('is_internal_transfer', false)
      q = q.or('and(user_category.is.null,category.is.null),and(user_category.is.null,category.not.in.(TRANSFER_IN,TRANSFER_OUT)),and(user_category.not.is.null,user_category.not.in.(TRANSFER_IN,TRANSFER_OUT))')
    }
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
    if (searchParams.txType === 'income') q = q.lt('amount_cents', 0)
    if (searchParams.txType === 'charges') q = q.gt('amount_cents', 0)
    return q
  }

  // Try with is_excluded + raw_name; fall back gracefully if columns don't exist yet
  let result = await makeQuery(true, true).range(from, from + pageSize - 1)
  if (result.error) result = await makeQuery(false, true).range(from, from + pageSize - 1)
  if (result.error) result = await makeQuery(false, false).range(from, from + pageSize - 1)

  const transactions = result.data as any[] | null
  const count: number | null = result.count
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  // Fetch distinct custom categories/subcategories the user has created
  const { data: customCatRows } = await supabase
    .from('transactions')
    .select('user_category, user_subcategory')
    .eq('user_id', user.id)
    .not('user_category', 'is', null)

  const allPlaidKeys = new Set(['INCOME','TRANSFER_IN','TRANSFER_OUT','LOAN_PAYMENTS','BANK_FEES',
    'ENTERTAINMENT','FOOD_AND_DRINK','GENERAL_MERCHANDISE','HOME_IMPROVEMENT','MEDICAL',
    'PERSONAL_CARE','GENERAL_SERVICES','GOVERNMENT_AND_NON_PROFIT','TRANSPORTATION','TRAVEL','RENT_AND_UTILITIES'])

  const customCategories = [...new Set(
    (customCatRows ?? []).map(r => r.user_category).filter((c): c is string => !!c && !allPlaidKeys.has(c))
  )].sort()

  const customSubcategories = [...new Set(
    (customCatRows ?? []).map(r => r.user_subcategory).filter((s): s is string => !!s && s !== 'Other' && !/^[A-Z_]+$/.test(s))
  )].sort()

  const [{ data: accounts }, { data: plaidItems }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, official_name, nickname, mask')
      .eq('user_id', user.id)
      .order('institution'),
    supabase
      .from('plaid_items')
      .select('last_synced_at')
      .eq('user_id', user.id)
      .order('last_synced_at', { ascending: false })
      .limit(1),
  ])

  const lastSyncedAt = (plaidItems?.[0] as any)?.last_synced_at as string | null | undefined

  const hasFilters = !!(searchParams.search || searchParams.account || searchParams.category || searchParams.subcategory || searchParams.dateFrom || searchParams.dateTo || searchParams.amountMin || searchParams.amountMax || showTransfers || showExcluded || searchParams.txType)

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
          {lastSyncedAt && (
            <span className="text-xs text-gray-300 ml-1">
              · updated {new Date(lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <div className="ml-auto">
            <SyncButton />
          </div>
        </div>

        <UndoBar />

        <TransactionFilters accounts={accounts ?? []} showTransfers={showTransfers} showExcluded={showExcluded} />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {!transactions?.length ? (
            <div className="py-16 text-center text-sm text-gray-400">No transactions match your filters</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => {
                const acct = tx.accounts as any
                const isCredit = tx.amount_cents < 0
                const effectiveCat = tx.user_category ?? tx.category
                const isInternal = tx.is_internal_transfer || effectiveCat === 'TRANSFER_IN' || effectiveCat === 'TRANSFER_OUT'
                const isExcluded = tx.is_excluded ?? false
                const isSplit = tx.is_split ?? false
                const hasSplits = tx.has_splits ?? false

                return (
                  <div key={tx.id} className={`px-5 py-3 ${isSplit || hasSplits ? 'bg-orange-50 border-l-2 border-orange-300' : ''} ${isInternal || isExcluded ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isSplit && <Scissors className="h-3 w-3 text-orange-400 shrink-0" />}
                        <p className={`text-sm font-medium truncate ${isSplit || hasSplits ? 'text-orange-800' : 'text-gray-900'} ${isExcluded ? 'line-through' : ''}`}>{tx.merchant_name}</p>
                        {tx.pending && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Pending</span>
                        )}
                        {isInternal && (
                          <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full shrink-0">Transfer</span>
                        )}
                        {hasSplits && tx.original_amount_cents && (
                          <span className="text-xs text-orange-400 shrink-0">was {fmt(tx.original_amount_cents)}</span>
                        )}
                      </div>
                      <p className={`text-sm font-semibold tabular-nums shrink-0 ${isCredit ? 'text-green-600' : isSplit || hasSplits ? 'text-orange-700' : 'text-gray-900'}`}>
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
                        <CategorySubcategoryPickers
                          transactionId={tx.id}
                          userCategory={tx.user_category}
                          plaidCategory={tx.category}
                          plaidSubcategory={tx.subcategory}
                          userSubcategory={tx.user_subcategory ?? null}
                          merchantName={tx.merchant_name ?? ''}
                          merchantNormalized={tx.merchant_normalized ?? tx.merchant_name ?? ''}
                          txDate={tx.date}
                          customCategories={customCategories}
                          customSubcategories={customSubcategories}
                        />
                        {!isInternal && (
                          <details className="mt-0.5">
                            <summary className="text-[10px] text-gray-300 cursor-pointer select-none hover:text-gray-400 list-none w-fit [&::-webkit-details-marker]:hidden">
                              · more
                            </summary>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="w-20 shrink-0"></span>
                              <div className="flex items-center gap-2 flex-wrap">
                                {tx.amount_cents > 0 && !isSplit && (
                                  <TransactionSplitButton
                                    transactionId={tx.id}
                                    transactionAmountCents={tx.amount_cents}
                                    merchantName={tx.merchant_name ?? 'Transaction'}
                                  />
                                )}
                                {hasSplits && <MergeSplitsButton transactionId={tx.id} />}
                                <ExcludeButton transactionId={tx.id} isExcluded={isExcluded} />
                              </div>
                            </div>
                          </details>
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
