import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label, category, subcategory, merchant_normalized, monthly_limit_cents, active } = body

  const update: Record<string, any> = {}
  if (label !== undefined) update.label = label.trim()
  if (category !== undefined) update.category = category || null
  if (subcategory !== undefined) update.subcategory = subcategory || null
  if (merchant_normalized !== undefined) update.merchant_normalized = merchant_normalized?.trim() || null
  if (monthly_limit_cents !== undefined) update.monthly_limit_cents = monthly_limit_cents
  if (active !== undefined) update.active = active

  const { data, error } = await supabase
    .from('spending_limits')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('spending_limits')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
