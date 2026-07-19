import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, boolean> = {}
  if ('is_excluded' in body) update.is_excluded = body.is_excluded
  if ('is_excluded_totals' in body) update.is_excluded_totals = body.is_excluded_totals
  if (!Object.keys(update).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const { error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
