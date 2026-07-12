import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { SpendingLimitsView, LimitRow } from '@/components/SpendingLimitsView'

export default async function LimitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Current month bounds
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = nextMonth.toISOString().slice(0, 10)

  const [{ data: limits }, { data: txRows }, { data: merchantRows }] = await Promise.all([
    supabase
      .from('spending_limits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),

    // Fetch current month transactions for spend calculation
    supabase
      .from('transactions')
      .select('amount_cents, category, user_category, subcategory, user_subcategory, merchant_normalized')
      .eq('user_id', user.id)
      .eq('pending', false)
      .eq('is_internal_transfer', false)
      .gte('date', monthStart)
      .lt('date', monthEnd)
      .gt('amount_cents', 0),

    // Distinct merchant names for autocomplete
    supabase
      .from('transactions')
      .select('merchant_normalized')
      .eq('user_id', user.id)
      .not('merchant_normalized', 'is', null)
      .limit(500),
  ])

  // Build spend lookup: category → cents, subcategory → cents, merchant → cents
  const categorySpend: Record<string, number> = {}
  const subcategorySpend: Record<string, number> = {}
  const merchantSpend: Record<string, number> = {}
  for (const tx of txRows ?? []) {
    const cat = tx.user_category ?? tx.category
    if (cat) categorySpend[cat] = (categorySpend[cat] ?? 0) + tx.amount_cents
    const sub = tx.user_subcategory ?? tx.subcategory
    if (sub) subcategorySpend[sub] = (subcategorySpend[sub] ?? 0) + tx.amount_cents
    if (tx.merchant_normalized) merchantSpend[tx.merchant_normalized] = (merchantSpend[tx.merchant_normalized] ?? 0) + tx.amount_cents
  }

  const initialLimits: LimitRow[] = (limits ?? []).map(l => ({
    ...l,
    spent_cents: l.merchant_normalized
      ? (merchantSpend[l.merchant_normalized] ?? 0)
      : l.subcategory
      ? (subcategorySpend[l.subcategory] ?? 0)
      : (categorySpend[l.category ?? ''] ?? 0),
  }))

  const merchants = [...new Set((merchantRows ?? []).map(r => r.merchant_normalized).filter(Boolean))].sort() as string[]

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Spending Limits</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {now.toLocaleString('default', { month: 'long', year: 'numeric' })} progress
            </p>
          </div>
        </div>

        <SpendingLimitsView initialLimits={initialLimits} merchants={merchants} />
      </main>
    </div>
  )
}
