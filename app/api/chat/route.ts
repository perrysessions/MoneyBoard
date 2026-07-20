import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { effectiveCategory } from '@/lib/categories'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })

const DAILY_TOKEN_LIMIT = 100_000

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ai_chat_usage')
    .select('tokens_used, requests_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  return NextResponse.json({
    tokensUsed: data?.tokens_used ?? 0,
    requestsCount: data?.requests_count ?? 0,
    dailyLimit: DAILY_TOKEN_LIMIT,
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  // Check daily limit
  const { data: usage } = await supabase
    .from('ai_chat_usage')
    .select('tokens_used, requests_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle()

  if ((usage?.tokens_used ?? 0) >= DAILY_TOKEN_LIMIT) {
    return NextResponse.json({ error: 'Daily token limit reached. Resets at midnight.' }, { status: 429 })
  }

  const { message, session_id } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'No message' }, { status: 400 })

  // Ensure session exists
  let sessionId = session_id
  if (!sessionId) {
    const { data: newSession, error: sessionErr } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, title: 'New Chat' })
      .select()
      .single()
    if (sessionErr) return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    sessionId = newSession.id
  }

  // Fetch previous messages for context (last 20)
  const { data: prevMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(20)

  // Build financial context
  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  const thisMonthStr = thisMonthStart.toISOString().slice(0, 10)
  const lastMonthStart = new Date(thisMonthStart)
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
  const lastMonthStr = lastMonthStart.toISOString().slice(0, 10)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 18)
  const threeMonthsStr = threeMonthsAgo.toISOString().slice(0, 10)

  const [txThisMonth, txLastMonth, txThreeMonths, accounts] = await Promise.all([
    supabase.from('transactions').select('amount_cents, category, user_category, merchant_name, date, is_excluded')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).gt('amount_cents', 0).gte('date', thisMonthStr),
    supabase.from('transactions').select('amount_cents, category, user_category, merchant_name, date, is_excluded')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).gt('amount_cents', 0).gte('date', lastMonthStr).lt('date', thisMonthStr),
    supabase.from('transactions').select('amount_cents, category, user_category, user_subcategory, subcategory, merchant_name, date, is_excluded')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).gte('date', threeMonthsStr),
    supabase.from('accounts').select('name, official_name, nickname, mask, type, subtype, institution').eq('user_id', user.id),
  ])

  const sumByCategory = (txs: any[]) => {
    const map: Record<string, number> = {}
    for (const t of txs) {
      if (t.is_excluded) continue
      const cat = effectiveCategory(t.user_category, t.category)
      if (cat === 'TRANSFER_IN' || cat === 'TRANSFER_OUT') continue
      map[cat] = (map[cat] ?? 0) + t.amount_cents
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([cat, cents]) => `  ${cat}: $${(cents / 100).toFixed(0)}`).join('\n')
  }

  // Per-category vendor breakdown for last 3 months
  const vendorsByCategory = () => {
    const catMap: Record<string, Record<string, number>> = {}
    for (const t of txThreeMonths.data ?? []) {
      if (t.is_excluded) continue
      if ((t.amount_cents ?? 0) === 0) continue
      const cat = effectiveCategory(t.user_category, t.category)
      if (cat === 'TRANSFER_IN' || cat === 'TRANSFER_OUT') continue
      const vendor = t.merchant_name ?? 'Unknown'
      if (!catMap[cat]) catMap[cat] = {}
      catMap[cat][vendor] = (catMap[cat][vendor] ?? 0) + Math.abs(t.amount_cents)
    }
    return Object.entries(catMap)
      .sort(([, a], [, b]) => Object.values(b).reduce((s, v) => s + v, 0) - Object.values(a).reduce((s, v) => s + v, 0))
      .map(([cat, vendors]) => {
        const total = Object.values(vendors).reduce((s, v) => s + v, 0)
        const lines = Object.entries(vendors).sort((a, b) => b[1] - a[1])
          .map(([v, c]) => `    ${v}: $${(c / 100).toFixed(2)} (${((c / total) * 100).toFixed(0)}%)`)
          .join('\n')
        return `  ${cat} ($${(total / 100).toFixed(0)} total):\n${lines}`
      }).join('\n')
  }

  const thisMonthTotal = (txThisMonth.data ?? []).filter((t: any) => !t.is_excluded).reduce((s: number, t: any) => s + t.amount_cents, 0)
  const lastMonthTotal = (txLastMonth.data ?? []).filter((t: any) => !t.is_excluded).reduce((s: number, t: any) => s + t.amount_cents, 0)

  const systemContext = `You are a personal finance assistant for Perry & Karen Sessions. Today is ${today}.

You have access to Google Search and can look up general financial statistics, national averages, benchmarks, and other external information when the user's question requires it — not just their personal data. Use search proactively when the user asks about averages, comparisons to typical households, or any external context.

ACCOUNTS:
${(accounts.data ?? []).map((a: any) => `  ${a.nickname ?? a.official_name ?? a.name} (${a.institution}, ${a.subtype}, ···${a.mask})`).join('\n')}

THIS MONTH SPENDING ($${(thisMonthTotal / 100).toFixed(0)} total, by category):
${sumByCategory(txThisMonth.data ?? [])}

LAST MONTH SPENDING ($${(lastMonthTotal / 100).toFixed(0)} total, by category):
${sumByCategory(txLastMonth.data ?? [])}

LAST 18 MONTHS — ALL VENDORS BY CATEGORY (every transaction, with % of category spend):
${vendorsByCategory()}

Answer the user's question using this data and web search when relevant. Be concise and helpful. Format dollar amounts with $ and commas. Use markdown for formatting (headers with ##, bold with **, bullet lists with -).`

  // Build contents array: system context as first exchange, then conversation history, then new message
  const contents: any[] = [
    { role: 'user', parts: [{ text: systemContext }] },
    { role: 'model', parts: [{ text: 'Understood. I have your financial data and am ready to help.' }] },
    ...(prevMessages ?? []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    const result = await model.generateContent({ contents, tools: [{ googleSearch: {} } as any] })
    const text = result.response.text()
    const tokensUsed = (result.response.usageMetadata?.promptTokenCount ?? 0) +
                       (result.response.usageMetadata?.candidatesTokenCount ?? 0)

    // Save both messages to DB and update session timestamp
    await Promise.all([
      supabase.from('chat_messages').insert([
        { session_id: sessionId, role: 'user', content: message },
        { session_id: sessionId, role: 'assistant', content: text, tokens_used: tokensUsed },
      ]),
      supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId),
    ])

    // Auto-title session from first message if still "New Chat"
    if (!prevMessages?.length) {
      const title = message.length > 50 ? message.slice(0, 47) + '…' : message
      await supabase.from('chat_sessions').update({ title }).eq('id', sessionId)
    }

    // Upsert usage
    const currentUsed = usage?.tokens_used ?? 0
    const currentReqs = usage?.requests_count ?? 0
    await supabase.from('ai_chat_usage').upsert({
      user_id: user.id, date: today,
      tokens_used: currentUsed + tokensUsed,
      requests_count: currentReqs + 1,
    }, { onConflict: 'user_id,date' })

    return NextResponse.json({
      reply: text,
      session_id: sessionId,
      tokensUsed,
      totalUsed: currentUsed + tokensUsed,
      dailyLimit: DAILY_TOKEN_LIMIT,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Gemini error' }, { status: 500 })
  }
}
