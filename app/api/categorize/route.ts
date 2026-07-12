import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeMerchants } from '@/lib/gemini/categorize'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all uncategorized transactions
  const { data: rows } = await supabase
    .from('transactions')
    .select('merchant_normalized')
    .eq('user_id', user.id)
    .is('ai_category', null)

  if (!rows?.length) return NextResponse.json({ categorized: 0, merchants: 0 })

  const uniqueMerchants = [...new Set(
    rows.map(r => r.merchant_normalized).filter(Boolean)
  )] as string[]

  if (!uniqueMerchants.length) return NextResponse.json({ categorized: 0, merchants: 0 })

  // Check our local cache first — no Gemini call needed for known merchants
  const { data: cached } = await supabase
    .from('merchant_categories')
    .select('merchant_normalized, category')
    .eq('user_id', user.id)
    .in('merchant_normalized', uniqueMerchants)

  const cacheMap: Record<string, string> = {}
  for (const row of cached ?? []) {
    cacheMap[row.merchant_normalized] = row.category
  }

  // Only send truly unknown merchants to Gemini
  const unknownMerchants = uniqueMerchants.filter(m => !cacheMap[m])

  let geminiMap: Record<string, string> = {}
  if (unknownMerchants.length > 0) {
    try {
      geminiMap = await categorizeMerchants(unknownMerchants)
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      console.error('GEMINI ERROR:', msg)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    // Save new results to cache so we never call Gemini for these again
    if (Object.keys(geminiMap).length > 0) {
      await supabase.from('merchant_categories').upsert(
        Object.entries(geminiMap).map(([merchant_normalized, category]) => ({
          user_id: user.id,
          merchant_normalized,
          category,
        })),
        { onConflict: 'user_id,merchant_normalized' }
      )
    }
  }

  // Merge cache + new results
  const categoryMap = { ...cacheMap, ...geminiMap }

  // Count how many uncategorized transactions will be updated
  const totalUpdated = rows.filter(r => r.merchant_normalized && categoryMap[r.merchant_normalized]).length

  // Apply to all matching transactions in bulk
  for (const [merchant, category] of Object.entries(categoryMap)) {
    await supabase
      .from('transactions')
      .update({ ai_category: category })
      .eq('user_id', user.id)
      .eq('merchant_normalized', merchant)
      .is('ai_category', null)
  }

  return NextResponse.json({
    categorized: totalUpdated,
    merchants: unknownMerchants.length, // how many actually hit Gemini
    fromCache: uniqueMerchants.length - unknownMerchants.length,
  })
}
