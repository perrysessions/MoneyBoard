import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label, amount_cents, category, subcategory } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 })
  if (!amount_cents || amount_cents <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })

  // Fetch the original transaction
  const { data: original, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, account_id, date, amount_cents, original_amount_cents, has_splits, pending')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !original) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (amount_cents >= original.amount_cents) return NextResponse.json({ error: `Split must be less than remaining amount ($${(original.amount_cents / 100).toFixed(2)})` }, { status: 400 })

  // Store the original full amount before any splits (only on first split)
  const storedOriginal = original.original_amount_cents ?? original.amount_cents

  // Create a real transaction row for the split
  const { data: splitTx, error: insertErr } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      account_id: original.account_id,
      plaid_transaction_id: `split_${params.id}_${Date.now()}`,
      date: original.date,
      amount_cents,
      merchant_name: label.trim(),
      merchant_normalized: label.trim().toLowerCase(),
      raw_name: label.trim(),
      is_split: true,
      split_from_id: params.id,
      user_category: category || null,
      user_subcategory: subcategory || null,
      manual_override: !!category,
      pending: false,
      is_internal_transfer: false,
      is_excluded: false,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Reduce original's amount and mark has_splits
  const { error: updateErr } = await supabase
    .from('transactions')
    .update({
      amount_cents: original.amount_cents - amount_cents,
      has_splits: true,
      original_amount_cents: storedOriginal,
    })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updateErr) {
    // Rollback split row
    await supabase.from('transactions').delete().eq('id', splitTx.id)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, splitId: splitTx.id, newOriginalAmount: original.amount_cents - amount_cents })
}
