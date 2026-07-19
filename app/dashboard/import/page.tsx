import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { ImportView } from '@/components/ImportView'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, official_name, nickname, mask, institution')
    .eq('user_id', user.id)
    .order('institution')

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <AppHeader email={user.email!} />
      <main className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Import CSV</h1>
        </div>
        <p className="text-sm text-gray-400 mb-6 ml-7">
          Drop Chase or Wells Fargo CSV exports. Transactions already covered by Plaid are skipped automatically.
        </p>
        <ImportView accounts={accounts ?? []} />
      </main>
    </div>
  )
}
