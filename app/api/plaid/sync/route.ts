import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('id, access_token, cursor')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ synced: 0 })

  let totalSynced = 0

  for (const item of items) {
    let cursor = item.cursor ?? undefined
    let hasMore = true

    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: item.access_token,
        cursor,
      })
      const { added, modified, removed, next_cursor, has_more } = res.data

      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, plaid_account_id')
        .eq('plaid_item_id', item.id)

      const accountMap = Object.fromEntries(
        (accounts ?? []).map(a => [a.plaid_account_id, a.id])
      )

      const batch = [...added, ...modified]
      const plaidIds = batch.map(t => t.transaction_id)

      // Find any existing transactions with active splits — we must not overwrite their amount_cents
      const { data: splitProtected } = plaidIds.length ? await supabase
        .from('transactions')
        .select('plaid_transaction_id')
        .in('plaid_transaction_id', plaidIds)
        .eq('has_splits', true) : { data: [] }

      const protectedIds = new Set((splitProtected ?? []).map((r: any) => r.plaid_transaction_id))

      const toUpsert = batch.map(t => ({
        user_id: user.id,
        account_id: accountMap[t.account_id] ?? null,
        plaid_transaction_id: t.transaction_id,
        date: t.date,
        // Only include amount_cents for rows that don't have active splits
        ...(!protectedIds.has(t.transaction_id) ? { amount_cents: Math.round(t.amount * 100) } : {}),
        raw_name: t.name,
        merchant_name: t.merchant_name ?? t.name,
        merchant_normalized: (t.merchant_name ?? t.name).toLowerCase().trim(),
        category: t.personal_finance_category?.primary ?? null,
        subcategory: t.personal_finance_category?.detailed ?? null,
        pending: t.pending,
      }))

      if (toUpsert.length) {
        await supabase
          .from('transactions')
          .upsert(toUpsert, { onConflict: 'plaid_transaction_id' })
        totalSynced += toUpsert.length
      }

      if (removed.length) {
        const ids = removed.map(r => r.transaction_id)
        await supabase.from('transactions').delete().in('plaid_transaction_id', ids)
      }

      cursor = next_cursor
      hasMore = has_more
    }

    await supabase.from('plaid_items').update({ cursor, last_synced_at: new Date().toISOString() }).eq('id', item.id)
  }

  // Apply merchant pattern overrides to any transactions that don't have a manual category yet
  await applyMerchantOverrides(supabase, user.id)

  // Detect internal transfers: match TRANSFER_OUT with TRANSFER_IN across
  // different accounts owned by the same user, same amount, within 2 days.
  await detectInternalTransfers(supabase, user.id)

  return NextResponse.json({ synced: totalSynced })
}

async function applyMerchantOverrides(supabase: any, userId: string) {
  const { data: overrides } = await supabase
    .from('merchant_overrides')
    .select('pattern, category')
    .eq('user_id', userId)

  if (!overrides?.length) return

  for (const override of overrides) {
    await supabase
      .from('transactions')
      .update({ user_category: override.category, manual_override: true })
      .eq('user_id', userId)
      .ilike('merchant_normalized', `%${override.pattern}%`)
      .is('user_category', null)
  }
}

async function detectInternalTransfers(supabase: any, userId: string) {
  // Reset all internal transfer flags first, then re-detect
  await supabase
    .from('transactions')
    .update({ is_internal_transfer: false })
    .eq('user_id', userId)
    .in('category', ['TRANSFER_OUT', 'TRANSFER_IN'])

  const { data: transfers } = await supabase
    .from('transactions')
    .select('id, account_id, amount_cents, date, category')
    .eq('user_id', userId)
    .in('category', ['TRANSFER_OUT', 'TRANSFER_IN'])
    .order('date')

  if (!transfers?.length) return

  const outs = transfers.filter((t: any) => t.amount_cents > 0)   // money leaving
  const ins  = transfers.filter((t: any) => t.amount_cents < 0)   // money arriving

  const matched = new Set<string>()

  for (const out of outs) {
    if (matched.has(out.id)) continue
    const outDate = new Date(out.date)

    const match = ins.find((t: any) => {
      if (matched.has(t.id)) return false
      if (t.account_id === out.account_id) return false  // same account, skip
      if (t.amount_cents !== -out.amount_cents) return false
      const diff = Math.abs(new Date(t.date).getTime() - outDate.getTime())
      return diff <= 2 * 24 * 60 * 60 * 1000  // within 2 days
    })

    if (match) {
      matched.add(out.id)
      matched.add(match.id)
    }
  }

  if (matched.size) {
    await supabase
      .from('transactions')
      .update({ is_internal_transfer: true })
      .in('id', [...matched])
  }
}
