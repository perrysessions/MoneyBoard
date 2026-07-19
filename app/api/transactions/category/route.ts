import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLAID_PRIMARY_CATEGORIES } from '@/lib/categories'

export type Scope = 'single' | 'all_past' | 'all'

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
    scope,           // 'single' | 'all_past' | 'all'
    merchant_normalized,
    pattern,         // vendor pattern for ILIKE matching (all/all_past scopes)
    date,            // transaction date string, used for all_past scoping
  } = await req.json()

  let affectedIds: string[] = []

  if (!scope || scope === 'single') {
    affectedIds = [transaction_id]
  } else {
    let q = supabase
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)

    if (pattern?.trim()) {
      q = q.ilike('merchant_normalized', `%${pattern.trim()}%`)
    } else {
      q = q.eq('merchant_normalized', merchant_normalized)
    }

    if (scope === 'all_past') q = q.lte('date', date)

    const { data } = await q
    affectedIds = (data ?? []).map((r: any) => r.id)
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
  const TRANSFER_CATS = new Set(['TRANSFER_IN', 'TRANSFER_OUT'])
  let updatePayload: Record<string, any>
  if (field === 'subcategory') {
    updatePayload = {
      user_subcategory: value ?? null,
    }
  } else {
    const isCustomCategory = value !== null && !PLAID_PRIMARY_CATEGORIES.includes(value)
    const isTransferCat = value !== null && TRANSFER_CATS.has(value)
    updatePayload = {
      user_category: value ?? null,
      manual_override: !!value,
      user_subcategory: isCustomCategory ? 'Other' : null,
      // Clear transfer flag when user explicitly picks a non-transfer category
      ...(value !== null && !isTransferCat ? { is_internal_transfer: false } : {}),
    }
  }

  const { error } = await supabase
    .from('transactions')
    .update(updatePayload)
    .in('id', affectedIds)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Store pattern override for future syncs when scope is 'all' and field is 'category'
  if (scope === 'all' && field === 'category' && pattern?.trim()) {
    await supabase.from('merchant_overrides').upsert({
      user_id: user.id,
      pattern: pattern.trim(),
      category: value ?? null,
    }, { onConflict: 'user_id,pattern' })
  }

  return NextResponse.json({ ok: true, affectedCount: affectedIds.length, oldValues })
}
