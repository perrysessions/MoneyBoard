import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'

import { ChartsView } from '@/components/ChartsView'
import { effectiveCategory, formatCategory } from '@/lib/categories'

export const dynamic = 'force-dynamic'

export default async function ChartsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const baseQuery = () => supabase
    .from('transactions')
    .select('date, amount_cents, category, subcategory, user_category, user_subcategory')
    .eq('user_id', user.id)
    .eq('pending', false)
    .eq('is_internal_transfer', false)
    .gt('amount_cents', 0)
    .order('date', { ascending: true })

  let result = await baseQuery().eq('is_excluded', false)
  if (result.error) result = await baseQuery()
  const transactions = result.data

  const txs = (transactions ?? []).map(t => ({
    date: t.date as string,
    amount_cents: t.amount_cents as number,
    category: effectiveCategory(t.user_category, t.category),
    subcategory: t.user_subcategory
      ? formatCategory(t.user_subcategory)
      : t.user_category
        ? effectiveCategory(t.user_category, t.category)
        : formatCategory(t.subcategory ?? t.category),
    categoryKey: (t.user_category ?? t.category ?? '') as string,
    subcategoryKey: (t.user_subcategory ?? t.subcategory ?? '') as string,
  }))

  const earliest = txs[0]?.date ?? null
  const latest = txs[txs.length - 1]?.date ?? null

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Charts</h1>
        <ChartsView transactions={txs} earliest={earliest} latest={latest} />
      </main>
      
    </div>
  )
}
