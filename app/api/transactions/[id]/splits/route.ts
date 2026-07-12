import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('transaction_splits')
    .select('id, label, amount_cents, category, subcategory, created_at')
    .eq('transaction_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label, amount_cents, category, subcategory } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 })
  if (!amount_cents || amount_cents <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })

  const { data, error } = await supabase
    .from('transaction_splits')
    .insert({
      transaction_id: params.id,
      user_id: user.id,
      label: label.trim(),
      amount_cents,
      category: category || null,
      subcategory: subcategory || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
