import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { DollarSign, LogOut } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { ChartsView } from '@/components/ChartsView'

export default async function ChartsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all non-pending, non-internal outgoing transactions with a category
  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, amount_cents, ai_category, user_category')
    .eq('user_id', user.id)
    .eq('pending', false)
    .eq('is_internal_transfer', false)
    .gt('amount_cents', 0)
    .order('date', { ascending: true })

  const txs = (transactions ?? []).map(t => ({
    date: t.date as string,
    amount_cents: t.amount_cents as number,
    category: (t.user_category ?? t.ai_category ?? 'Uncategorized') as string,
  }))

  const earliest = txs[0]?.date ?? null
  const latest = txs[txs.length - 1]?.date ?? null

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
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Charts</h1>
        <ChartsView transactions={txs} earliest={earliest} latest={latest} />
      </main>
      <BottomNav />
    </div>
  )
}
