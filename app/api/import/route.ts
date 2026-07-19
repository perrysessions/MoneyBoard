import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { PLAID_PRIMARY_CATEGORIES } from '@/lib/categories'

export const maxDuration = 60

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })

export interface ImportRow {
  date: string
  merchant_name: string
  merchant_normalized: string
  amount_cents: number
  account_id: string
  import_source: 'chase_csv' | 'wells_csv'
  plaid_transaction_id: string
}

// GET — return floor dates (earliest existing transaction per account)
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ids = searchParams.get('accountIds')?.split(',').filter(Boolean) ?? []

  if (!ids.length) return NextResponse.json({})

  const { data } = await supabase
    .from('transactions')
    .select('account_id, date')
    .eq('user_id', user.id)
    .in('account_id', ids)
    .order('date', { ascending: true })

  const floors: Record<string, string> = {}
  for (const r of data ?? []) {
    if (!floors[r.account_id]) floors[r.account_id] = r.date
  }

  return NextResponse.json(floors)
}

// POST — categorize and insert rows
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows }: { rows: ImportRow[] } = await req.json()
  if (!rows?.length) return NextResponse.json({ imported: 0, skipped: 0 })

  // Re-check floor dates server-side (safety net)
  const accountIds = [...new Set(rows.map(r => r.account_id))]
  const { data: floorData } = await supabase
    .from('transactions')
    .select('account_id, date')
    .eq('user_id', user.id)
    .in('account_id', accountIds)
    .order('date', { ascending: true })

  const floorMap: Record<string, string> = {}
  for (const r of floorData ?? []) {
    if (!floorMap[r.account_id]) floorMap[r.account_id] = r.date
  }

  const toImport = rows.filter(r => {
    const floor = floorMap[r.account_id]
    return !floor || r.date < floor
  })

  if (!toImport.length) return NextResponse.json({ imported: 0, skipped: rows.length })

  // Batch Gemini categorization
  const categoryMap = await batchCategorize(supabase, user.id, toImport)

  // Build upsert payload
  const toInsert = toImport.map(r => ({
    user_id: user.id,
    account_id: r.account_id,
    plaid_transaction_id: r.plaid_transaction_id,
    date: r.date,
    amount_cents: r.amount_cents,
    raw_name: r.merchant_name,
    merchant_name: r.merchant_name,
    merchant_normalized: r.merchant_normalized,
    category: categoryMap[r.merchant_normalized] ?? null,
    subcategory: null,
    pending: false,
    import_source: r.import_source,
  }))

  // Insert in batches of 200 to avoid payload limits
  let imported = 0
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200)
    const { error } = await supabase
      .from('transactions')
      .upsert(batch, { onConflict: 'plaid_transaction_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    imported += batch.length
  }

  return NextResponse.json({ imported, skipped: rows.length - imported })
}

async function batchCategorize(supabase: any, userId: string, rows: ImportRow[]) {
  const merchants = [...new Set(rows.map(r => r.merchant_normalized))]

  // Check cache first
  const { data: cached } = await supabase
    .from('merchant_categories')
    .select('merchant_normalized, category')
    .eq('user_id', userId)
    .in('merchant_normalized', merchants)

  const resultMap: Record<string, string> = {}
  const cachedSet = new Set<string>()
  for (const c of cached ?? []) {
    resultMap[c.merchant_normalized] = c.category
    cachedSet.add(c.merchant_normalized)
  }

  const uncached = merchants.filter(m => !cachedSet.has(m))
  if (!uncached.length) return resultMap

  // Gemini in chunks of 80 merchants
  for (let i = 0; i < uncached.length; i += 80) {
    const chunk = uncached.slice(i, i + 80)
    try {
      const prompt = `Categorize each bank transaction merchant/description into exactly one Plaid category key.

Valid category keys: ${PLAID_PRIMARY_CATEGORIES.join(', ')}

Rules:
- Transfers between bank accounts → TRANSFER_IN or TRANSFER_OUT
- Paycheck/salary/direct deposit → INCOME
- Interest payments → INCOME
- Credit card payments → TRANSFER_OUT
- Use the most specific category that fits

Return ONLY a JSON object. No markdown, no explanation.
Format: {"merchant_normalized": "CATEGORY_KEY"}

Merchants:
${chunk.map((m, i) => `${i + 1}. ${m}`).join('\n')}`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim().replace(/```json\n?|\n?```/g, '')
      const json = JSON.parse(text)

      const toCache: any[] = []
      for (const [merchant, category] of Object.entries(json)) {
        if (typeof category === 'string' && PLAID_PRIMARY_CATEGORIES.includes(category)) {
          resultMap[merchant] = category
          toCache.push({ user_id: userId, merchant_normalized: merchant, category })
        }
      }

      if (toCache.length) {
        await supabase
          .from('merchant_categories')
          .upsert(toCache, { onConflict: 'user_id,merchant_normalized' })
      }
    } catch {
      // Continue without categories for this chunk
    }
  }

  return resultMap
}
