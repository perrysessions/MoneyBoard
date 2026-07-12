import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid/client'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { public_token, institution_id, institution_name } = await req.json()

  const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
  const { access_token, item_id } = exchangeRes.data

  // Remove any existing items for this institution (Chase rotates account IDs on re-link)
  const { data: oldItems } = await supabase
    .from('plaid_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('institution_id', institution_id)

  if (oldItems?.length) {
    const oldIds = oldItems.map(i => i.id)
    // Null out account references first (constraint is now on delete set null)
    await supabase.from('accounts').update({ plaid_item_id: null }).in('plaid_item_id', oldIds)
    await supabase.from('plaid_items').delete().in('id', oldIds)
  }

  const { data: item, error: itemError } = await supabase
    .from('plaid_items')
    .insert({ user_id: user.id, plaid_item_id: item_id, access_token, institution_id, institution_name, cursor: null })
    .select()
    .single()

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })

  const accountsRes = await plaidClient.accountsGet({ access_token })
  const plaidAccounts = accountsRes.data.accounts

  for (const a of plaidAccounts) {
    // Match existing account by institution + mask + type so re-linking reuses our UUID
    // This survives Chase rotating plaid_account_id on every re-link
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution', institution_name)
      .eq('mask', a.mask ?? '')
      .eq('type', a.type)
      .eq('subtype', a.subtype ?? '')
      .maybeSingle()

    if (existing) {
      await supabase
        .from('accounts')
        .update({
          plaid_item_id: item.id,
          plaid_account_id: a.account_id,
          name: a.name,
          official_name: a.official_name ?? null,
          mask: a.mask ?? null,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('accounts').insert({
        user_id: user.id,
        plaid_item_id: item.id,
        plaid_account_id: a.account_id,
        institution: institution_name,
        type: a.type,
        subtype: a.subtype ?? null,
        name: a.name,
        official_name: a.official_name ?? null,
        mask: a.mask ?? null,
      })
    }
  }

  return NextResponse.json({ ok: true, institution: institution_name, accounts: plaidAccounts.length })
}
