import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, CreditCard, LogOut } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white rounded-lg p-1.5">
            <DollarSign className="h-4 w-4" />
          </div>
          <span className="font-semibold text-gray-900">Money Board</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user.email}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit" className="text-gray-500 hover:text-gray-700">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>

        {/* Placeholder stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-gray-900">—</p>
              <p className="text-xs text-gray-400 mt-1">Connect your bank to get started</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Top Category</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-gray-900">—</p>
              <p className="text-xs text-gray-400 mt-1">No transactions yet</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Accounts</CardTitle>
              <CreditCard className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-gray-900">0</p>
              <p className="text-xs text-gray-400 mt-1">No banks connected</p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Bank connection coming in Chunk 2.</p>
          <p className="text-gray-400 text-xs mt-1">Auth is working — you&apos;re signed in as {user.email}</p>
        </div>
      </main>
    </div>
  )
}
