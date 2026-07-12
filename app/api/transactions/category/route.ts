import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transaction_id, user_category } = await req.json()

  const { error } = await supabase
    .from('transactions')
    .update({
      user_category: user_category || null,
      manual_override: !!user_category,
    })
    .eq('id', transaction_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
