import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, TrendingDown, CreditCard, Landmark } from 'lucide-react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { DashboardDateFilter } from '@/components/DashboardDateFilter'
import { OverviewChart } from '@/components/OverviewChart'
import { Suspense } from 'react'

const fmt = (cents: number) => {
  const n = cents / 100
  if (n >= 10000) return '$' + (n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 })
}

function dateRangeLabel(from: string | undefined, to: string | undefined, preset: string | undefined) {
  if (preset === 'all' || (!from && !to)) return 'All Time'
  if (!from || !to) return ''
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmtDate(f)} – ${fmtDate(t)}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { preset?: string; from?: string; to?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const preset = searchParams.preset ?? 'thisMonth'
  let from = searchParams.from
  let to = searchParams.to

  // Compute dates from preset if not explicitly provided
  if (!from && !to && preset !== 'all') {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const todayStr = fmt(today)
    if (preset === 'thisMonth') {
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1))
      to = todayStr
    } else if (preset === 'lastMonth') {
      from = fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1))
      to = fmt(new Date(today.getFullYear(), today.getMonth(), 0))
    } else if (preset === '30d') {
      const d = new Date(today); d.setDate(d.getDate() - 30)
      from = fmt(d); to = todayStr
    } else if (preset === '3m') {
      const d = new Date(today); d.setMonth(d.getMonth() - 3)
      from = fmt(d); to = todayStr
    } else if (preset === 'ytd') {
      from = `${today.getFullYear()}-01-01`; to = todayStr
    } else {
      // default fallback
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1))
      to = todayStr
    }
  }

  const buildSpendQuery = (excludeCol: boolean) => {
    let q = supabase
      .from('transactions')
      .select('amount_cents, account_id, accounts(type, subtype)')
      .eq('user_id', user.id)
      .eq('pending', false)
      .eq('is_internal_transfer', false)
      .gt('amount_cents', 0)
    if (excludeCol) { q = q.eq('is_excluded', false); q = q.eq('is_excluded_totals', false) }
    q = q.or('and(user_category.is.null,category.is.null),and(user_category.is.null,category.not.in.(TRANSFER_IN,TRANSFER_OUT)),and(user_category.not.is.null,user_category.not.in.(TRANSFER_IN,TRANSFER_OUT))')
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    return q
  }

  const buildIncomeQuery = (excludeCol: boolean) => {
    let q = supabase
      .from('transactions')
      .select('amount_cents')
      .eq('user_id', user.id)
      .eq('pending', false)
      .eq('is_internal_transfer', false)
      .lt('amount_cents', 0)
    if (excludeCol) { q = q.eq('is_excluded', false); q = q.eq('is_excluded_totals', false) }
    q = q.or('and(user_category.is.null,category.is.null),and(user_category.is.null,category.not.in.(TRANSFER_IN,TRANSFER_OUT)),and(user_category.not.is.null,user_category.not.in.(TRANSFER_IN,TRANSFER_OUT))')
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    return q
  }

  const fetchChartTxs = async (excludeCol: boolean) => {
    const PAGE = 1000
    const rows: { date: string; amount_cents: number }[] = []
    let offset = 0
    while (true) {
      let q = supabase
        .from('transactions')
        .select('date, amount_cents')
        .eq('user_id', user.id)
        .eq('pending', false)
        .eq('is_internal_transfer', false)
      if (excludeCol) { q = q.eq('is_excluded', false); q = q.eq('is_excluded_totals', false) }
      q = q.or('and(user_category.is.null,category.is.null),and(user_category.is.null,category.not.in.(TRANSFER_IN,TRANSFER_OUT)),and(user_category.not.is.null,user_category.not.in.(TRANSFER_IN,TRANSFER_OUT))')
      if (from) q = q.gte('date', from)
      if (to) q = q.lte('date', to)
      const { data, error } = await q.range(offset, offset + PAGE - 1)
      if (error) return { data: null, error }
      rows.push(...(data ?? []))
      if ((data?.length ?? 0) < PAGE) break
      offset += PAGE
    }
    return { data: rows, error: null }
  }

  // Try with is_excluded filter; fall back gracefully if column doesn't exist yet
  let [spendResult, incomeResult, countResult, earliestTxResult] = await Promise.all([
    buildSpendQuery(true),
    buildIncomeQuery(true),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('transactions').select('date').eq('user_id', user.id).order('date', { ascending: true }).limit(1).maybeSingle(),
  ])

  if (spendResult.error || incomeResult.error) {
    ;[spendResult, incomeResult] = await Promise.all([
      buildSpendQuery(false),
      buildIncomeQuery(false),
    ])
  }

  let chartResult = await fetchChartTxs(true)
  if (chartResult.error) chartResult = await fetchChartTxs(false)

  const txData = spendResult.data
  const incomeData = incomeResult.data
  const txCount = countResult.count
  const earliestDate = (earliestTxResult.data as any)?.date as string | null | undefined
  const chartTxs = (chartResult.data ?? []) as { date: string; amount_cents: number }[]

  const allTx = txData ?? []
  const totalSpend = allTx.reduce((s, t) => s + t.amount_cents, 0)
  const ccSpend = allTx
    .filter((t: any) => t.accounts?.type === 'credit')
    .reduce((s, t) => s + t.amount_cents, 0)
  const cashOut = allTx
    .filter((t: any) => t.accounts?.type === 'depository')
    .reduce((s, t) => s + t.amount_cents, 0)
  const totalIncome = Math.abs((incomeData ?? []).reduce((s, t) => s + t.amount_cents, 0))

  const label = dateRangeLabel(from, to, preset)

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">{label}</h1>

        <Suspense fallback={null}>
          <DashboardDateFilter earliestDate={earliestDate} />
        </Suspense>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Link href={`/dashboard/transactions?txType=charges${from ? `&dateFrom=${from}` : ''}${to ? `&dateTo=${to}` : ''}`} className="block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Spend</span>
                <TrendingUp className="h-4 w-4 text-gray-300" />
              </div>
              <p className="text-2xl font-semibold text-gray-900">{totalSpend > 0 ? fmt(totalSpend) : '—'}</p>
              <p className="text-xs text-gray-400 mt-1">All outflows</p>
            </div>
          </Link>

          <Link href={`/dashboard/transactions?txType=income${from ? `&dateFrom=${from}` : ''}${to ? `&dateTo=${to}` : ''}`} className="block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Income</span>
                <TrendingDown className="h-4 w-4 text-green-300" />
              </div>
              <p className="text-2xl font-semibold text-green-600">{totalIncome > 0 ? fmt(totalIncome) : '—'}</p>
              <p className="text-xs text-gray-400 mt-1">Credits & deposits</p>
            </div>
          </Link>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Credit Cards</span>
              <CreditCard className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{ccSpend > 0 ? fmt(ccSpend) : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Charges on cards</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cash Out</span>
              <Landmark className="h-4 w-4 text-gray-300" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">{cashOut > 0 ? fmt(cashOut) : '—'}</p>
            <p className="text-xs text-gray-400 mt-1">From checking / savings</p>
          </div>
        </div>

        <OverviewChart transactions={chartTxs} dateFrom={from} dateTo={to} />

        <Link href="/dashboard/transactions" className="block">
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
      </main>
    </div>
  )
}
