import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { changes } = await req.json() as {
    changes: Array<{
      id: string
      user_category: string | null
      user_subcategory: string | null
      manual_override: boolean
    }>
  }

  if (!changes?.length) return NextResponse.json({ error: 'No changes' }, { status: 400 })

  // Revert each transaction to its old state
  const updates = changes.map(c =>
    supabase
      .from('transactions')
      .update({
        user_category: c.user_category,
        user_subcategory: c.user_subcategory,
        manual_override: c.manual_override,
      })
      .eq('id', c.id)
      .eq('user_id', user.id)
  )

  await Promise.all(updates)

  return NextResponse.json({ ok: true, reverted: changes.length })
}
