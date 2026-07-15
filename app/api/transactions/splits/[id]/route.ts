import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the split transaction to find parent and amount
  const { data: split } = await supabase
    .from('transactions')
    .select('id, amount_cents, split_from_id, is_split')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!split?.is_split || !split.split_from_id) {
    return NextResponse.json({ error: 'Not a split transaction' }, { status: 400 })
  }

  // Delete the split transaction
  await supabase.from('transactions').delete().eq('id', params.id).eq('user_id', user.id)

  // Check if any splits remain on the parent
  const { data: remaining } = await supabase
    .from('transactions')
    .select('id')
    .eq('split_from_id', split.split_from_id)
    .eq('user_id', user.id)

  const { data: parent } = await supabase
    .from('transactions')
    .select('amount_cents, original_amount_cents')
    .eq('id', split.split_from_id)
    .eq('user_id', user.id)
    .single()

  if (parent) {
    const noSplitsLeft = !remaining?.length
    await supabase.from('transactions').update({
      amount_cents: parent.amount_cents + split.amount_cents,
      has_splits: !noSplitsLeft,
      original_amount_cents: noSplitsLeft ? null : parent.original_amount_cents,
    }).eq('id', split.split_from_id).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
