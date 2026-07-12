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
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsStr = threeMonthsAgo.toISOString().slice(0, 10)

  const [txThisMonth, txLastMonth, txThreeMonths, accounts, recentTx] = await Promise.all([
    supabase.from('transactions').select('amount_cents, category, user_category')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).gt('amount_cents', 0).gte('date', thisMonthStr),
    supabase.from('transactions').select('amount_cents, category, user_category')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).gt('amount_cents', 0).gte('date', lastMonthStr).lt('date', thisMonthStr),
    supabase.from('transactions').select('amount_cents, category, user_category, date, merchant_name')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).gt('amount_cents', 0).gte('date', threeMonthsStr),
    supabase.from('accounts').select('name, official_name, nickname, mask, type, subtype, institution').eq('user_id', user.id),
    supabase.from('transactions').select('date, merchant_name, amount_cents, category, user_category')
      .eq('user_id', user.id).eq('pending', false).eq('is_internal_transfer', false).order('date', { ascending: false }).limit(10),
  ])

  const sumByCategory = (txs: any[]) => {
    const map: Record<string, number> = {}
    for (const t of txs) {
      const cat = effectiveCategory(t.user_category, t.category)
      map[cat] = (map[cat] ?? 0) + t.amount_cents
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([cat, cents]) => `  ${cat}: $${(cents / 100).toFixed(0)}`).join('\n')
  }

  const topMerchants = () => {
    const map: Record<string, number> = {}
    for (const t of txThreeMonths.data ?? []) {
      map[t.merchant_name] = (map[t.merchant_name] ?? 0) + t.amount_cents
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([m, c]) => `  ${m}: $${(c / 100).toFixed(0)}`).join('\n')
  }

  const thisMonthTotal = (txThisMonth.data ?? []).reduce((s, t) => s + t.amount_cents, 0)
  const lastMonthTotal = (txLastMonth.data ?? []).reduce((s, t) => s + t.amount_cents, 0)

  const systemContext = `You are a personal finance assistant for Perry & Karen Sessions. Today is ${today}.

ACCOUNTS:
${(accounts.data ?? []).map(a => `  ${a.nickname ?? a.official_name ?? a.name} (${a.institution}, ${a.subtype}, ···${a.mask})`).join('\n')}

THIS MONTH SPENDING ($${(thisMonthTotal / 100).toFixed(0)} total):
${sumByCategory(txThisMonth.data ?? [])}

LAST MONTH SPENDING ($${(lastMonthTotal / 100).toFixed(0)} total):
${sumByCategory(txLastMonth.data ?? [])}

TOP MERCHANTS (last 3 months):
${topMerchants()}

RECENT TRANSACTIONS:
${(recentTx.data ?? []).map(t => `  ${t.date} · ${t.merchant_name} · $${(t.amount_cents / 100).toFixed(2)} · ${effectiveCategory(t.user_category, t.category)}`).join('\n')}

Answer the user's question using this data. Be concise and helpful. Format dollar amounts with $ and commas. Use markdown for formatting (headers with ##, bold with **, bullet lists with -).`

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
    const result = await model.generateContent({ contents })
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
