import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/categories — rename a category or subcategory across all transactions
// DELETE /api/categories — delete (clear) a category or subcategory across all transactions

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { field, oldValue, newValue } = await req.json()
  if (!field || !oldValue || !newValue?.trim()) {
    return NextResponse.json({ error: 'field, oldValue, newValue required' }, { status: 400 })
  }

  const col = field === 'category' ? 'user_category' : 'user_subcategory'
  const { error } = await supabase
    .from('transactions')
    .update({ [col]: newValue.trim() })
    .eq('user_id', user.id)
    .eq(col, oldValue)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { field, value } = await req.json()
  if (!field || !value) {
    return NextResponse.json({ error: 'field and value required' }, { status: 400 })
  }

  const col = field === 'category' ? 'user_category' : 'user_subcategory'
  const { error } = await supabase
    .from('transactions')
    .update({ [col]: null, ...(col === 'user_category' ? { manual_override: false } : {}) })
    .eq('user_id', user.id)
    .eq(col, value)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
