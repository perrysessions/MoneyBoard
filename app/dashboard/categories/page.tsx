import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { CategoriesManager } from '@/components/CategoriesManager'

const PLAID_PRIMARY = new Set([
  'INCOME','TRANSFER_IN','TRANSFER_OUT','LOAN_PAYMENTS','BANK_FEES',
  'ENTERTAINMENT','FOOD_AND_DRINK','GENERAL_MERCHANDISE','HOME_IMPROVEMENT','MEDICAL',
  'PERSONAL_CARE','GENERAL_SERVICES','GOVERNMENT_AND_NON_PROFIT','TRANSPORTATION','TRAVEL','RENT_AND_UTILITIES',
])

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: catRows }, { data: subRows }] = await Promise.all([
    supabase
      .from('transactions')
      .select('user_category')
      .eq('user_id', user.id)
      .not('user_category', 'is', null),
    supabase
      .from('transactions')
      .select('user_subcategory')
      .eq('user_id', user.id)
      .not('user_subcategory', 'is', null),
  ])

  // Count occurrences of each custom category
  const catCounts: Record<string, number> = {}
  for (const r of catRows ?? []) {
    const c = r.user_category
    if (c && !PLAID_PRIMARY.has(c)) catCounts[c] = (catCounts[c] ?? 0) + 1
  }

  const subCounts: Record<string, number> = {}
  for (const r of subRows ?? []) {
    const s = r.user_subcategory
    if (s && !/^[A-Z_]+$/.test(s)) subCounts[s] = (subCounts[s] ?? 0) + 1
  }

  const customCategories = Object.entries(catCounts).sort((a, b) => a[0].localeCompare(b[0]))
  const customSubcategories = Object.entries(subCounts).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />
      <main className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Manage Categories</h1>
        </div>
        <CategoriesManager
          customCategories={customCategories}
          customSubcategories={customSubcategories}
        />
      </main>
    </div>
  )
}
