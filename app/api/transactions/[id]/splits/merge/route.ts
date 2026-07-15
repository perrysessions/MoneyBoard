import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: original } = await supabase
    .from('transactions')
    .select('id, original_amount_cents')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete all split child transactions
  await supabase
    .from('transactions')
    .delete()
    .eq('split_from_id', params.id)
    .eq('user_id', user.id)

  // Restore original amount and clear split flags
  await supabase
    .from('transactions')
    .update({
      amount_cents: original.original_amount_cents,
      has_splits: false,
      original_amount_cents: null,
    })
    .eq('id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
