import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type Scope = 'single' | 'this_and_future' | 'all_past' | 'all'

export interface OldValue {
  id: string
  user_category: string | null
  user_subcategory: string | null
  manual_override: boolean
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    transaction_id,
    field,           // 'category' | 'subcategory'
    value,           // new value (string | null)
    scope,           // 'single' | 'this_and_future' | 'all_past' | 'all'
    merchant_normalized,
    date,            // transaction date string, used for scoping
  } = await req.json()

  // Fetch old values for undo before applying changes
  let affectedIds: string[] = []

  if (!scope || scope === 'single') {
    affectedIds = [transaction_id]
  } else {
    let q = supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('merchant_normalized', merchant_normalized)

    if (scope === 'this_and_future') q = q.gte('date', date)
    else if (scope === 'all_past') q = q.lte('date', date)
    // 'all' — no date filter

    const { data } = await q
    affectedIds = (data ?? []).map((r: any) => r.id)
    // Always include the triggering transaction
    if (!affectedIds.includes(transaction_id)) affectedIds.push(transaction_id)
  }

  // Fetch current values for undo payload
  const { data: oldRows } = await supabase
    .from('transactions')
    .select('id, user_category, user_subcategory, manual_override')
    .in('id', affectedIds)
    .eq('user_id', user.id)

  const oldValues: OldValue[] = (oldRows ?? []).map((r: any) => ({
    id: r.id,
    user_category: r.user_category,
    user_subcategory: r.user_subcategory ?? null,
    manual_override: r.manual_override ?? false,
  }))

  // Build the update payload
  let updatePayload: Record<string, any>
  if (field === 'subcategory') {
    updatePayload = {
      user_subcategory: value ?? null,
    }
  } else {
    // category field — clearing user_category also clears user_subcategory
    updatePayload = {
      user_category: value ?? null,
      manual_override: !!value,
      ...(value === null ? { user_subcategory: null } : {}),
    }
  }

  const { error } = await supabase
    .from('transactions')
    .update(updatePayload)
    .in('id', affectedIds)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, affectedCount: affectedIds.length, oldValues })
}
