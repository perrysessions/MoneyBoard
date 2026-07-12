import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label, category, subcategory, merchant_normalized, monthly_limit_cents } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'Label required' }, { status: 400 })
  if (!monthly_limit_cents || monthly_limit_cents <= 0) return NextResponse.json({ error: 'Invalid limit amount' }, { status: 400 })
  if (!category && !subcategory && !merchant_normalized) return NextResponse.json({ error: 'Category, subcategory, or merchant required' }, { status: 400 })

  const { data, error } = await supabase.from('spending_limits').insert({
    user_id: user.id,
    label: label.trim(),
    category: category || null,
    subcategory: subcategory || null,
    merchant_normalized: merchant_normalized?.trim() || null,
    monthly_limit_cents,
    active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
