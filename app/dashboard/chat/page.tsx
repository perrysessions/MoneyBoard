import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'

import { ChatView } from '@/components/ChatView'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 pb-8 flex flex-col">
      <AppHeader email={user.email!} />
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 flex flex-col">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Ask AI</h1>
        <div className="flex-1 flex flex-col">
          <ChatView />
        </div>
      </main>
      
    </div>
  )
}
