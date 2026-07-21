import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { effectiveCategory } from '@/lib/categories'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })

const DAILY_TOKEN_LIMIT = 100_000
const MAX_TOOL_ROUNDS = 8

// Signal tool — Gemini calls this when it needs live web data.
// We detect it, finish any pending finance queries, then make a second call with googleSearch.
const WEB_SEARCH_TOOL = {
  name: 'request_web_search',
  description:
    'Call this when the question requires current internet data: national averages, benchmarks, news, interest rates, cost of living stats, or any real-world info not in the user\'s personal transaction history. Do NOT call this for questions answerable from transaction data alone.',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Brief reason why web search is needed' },
    },
  },
}

// Tool declarations — Gemini decides which to call based on the user's question
const FINANCE_TOOLS = [
  {
    name: 'get_transactions',
    description:
      'Search individual transactions. Returns date, amount, merchant_name, raw_name (exact bank string — useful for parsing memos like "BBA DRAW 3 JUNE 2026"), and category. Use this when you need to see specific transactions, parse memo text, or list charges matching a keyword.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD (inclusive)' },
        date_to: { type: 'string', description: 'End date YYYY-MM-DD (inclusive)' },
        merchant_contains: {
          type: 'string',
          description: 'Case-insensitive keyword matched against merchant name and raw bank description string',
        },
        category: { type: 'string', description: 'Filter to this category (e.g. INCOME, FOOD_AND_DRINK)' },
        type: {
          type: 'string',
          enum: ['charges', 'income', 'all'],
          description: 'charges = outflows (positive), income = inflows (negative), all = both. Default: all',
        },
        limit: { type: 'number', description: 'Max rows (default 200, max 500)' },
      },
    },
  },
  {
    name: 'sum_by_category',
    description:
      'Total spending or income grouped by category for a date range. Good for "how much did we spend on X" or category breakdowns.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        date_to: { type: 'string', description: 'End date YYYY-MM-DD' },
        type: {
          type: 'string',
          enum: ['charges', 'income', 'all'],
          description: 'Default: charges',
        },
      },
    },
  },
  {
    name: 'sum_by_merchant',
    description:
      'Totals grouped by merchant name for a date range, optionally filtered by keyword or category. Good for "top merchants" or "how much at Walmart".',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        date_to: { type: 'string', description: 'End date YYYY-MM-DD' },
        merchant_contains: { type: 'string', description: 'Keyword to filter merchants' },
        category: { type: 'string', description: 'Limit to this category' },
        type: {
          type: 'string',
          enum: ['charges', 'income', 'all'],
          description: 'Default: charges',
        },
      },
    },
  },
  {
    name: 'get_monthly_totals',
    description:
      'Month-by-month totals (spending, income, or both). Good for trend questions, "how much each month", or monthly income breakdowns. Optionally filter by category or merchant keyword.',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        date_to: { type: 'string', description: 'End date YYYY-MM-DD' },
        category: { type: 'string', description: 'Filter to specific category' },
        merchant_contains: { type: 'string', description: 'Filter to merchant matching this keyword' },
        type: {
          type: 'string',
          enum: ['charges', 'income', 'all'],
          description: 'Default: all',
        },
      },
    },
  },
]

async function runTool(
  name: string,
  args: Record<string, any>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  try {
    if (name === 'get_transactions') {
      const { date_from, date_to, merchant_contains, category, type = 'all', limit = 200 } = args
      const cap = Math.min(Number(limit) || 200, 500)

      // Paginate to get all matching rows (up to cap)
      const PAGE = 1000
      const rows: any[] = []
      let offset = 0
      while (rows.length < cap) {
        let q = supabase
          .from('transactions')
          .select('date, amount_cents, merchant_name, raw_name, category, user_category, is_excluded')
          .eq('user_id', userId)
          .eq('pending', false)
          .eq('is_internal_transfer', false)
          .order('date', { ascending: false })
          .range(offset, offset + Math.min(PAGE, cap - rows.length) - 1)

        if (date_from) q = q.gte('date', date_from)
        if (date_to) q = q.lte('date', date_to)
        if (type === 'charges') q = q.gt('amount_cents', 0)
        if (type === 'income') q = q.lt('amount_cents', 0)
        if (merchant_contains) {
          const kw = merchant_contains.replace(/'/g, "''")
          q = q.or(`merchant_name.ilike.%${kw}%,raw_name.ilike.%${kw}%,merchant_normalized.ilike.%${kw}%`)
        }

        const { data, error } = await q
        if (error) return JSON.stringify({ error: error.message })
        rows.push(...(data ?? []))
        if ((data?.length ?? 0) < Math.min(PAGE, cap)) break
        offset += PAGE
      }

      const filtered = rows
        .filter(t => !t.is_excluded)
        .filter(t => !category || effectiveCategory(t.user_category, t.category) === category)
        .map(t => ({
          date: t.date,
          amount: (t.amount_cents / 100).toFixed(2),
          merchant: t.merchant_name,
          raw_name: t.raw_name,
          category: effectiveCategory(t.user_category, t.category),
        }))

      return JSON.stringify({ count: filtered.length, transactions: filtered })
    }

    if (name === 'sum_by_category') {
      const { date_from, date_to, type = 'charges' } = args
      const PAGE = 1000
      const rows: any[] = []
      let offset = 0
      while (true) {
        let q = supabase
          .from('transactions')
          .select('amount_cents, category, user_category, is_excluded')
          .eq('user_id', userId)
          .eq('pending', false)
          .eq('is_internal_transfer', false)
          .range(offset, offset + PAGE - 1)

        if (date_from) q = q.gte('date', date_from)
        if (date_to) q = q.lte('date', date_to)
        if (type === 'charges') q = q.gt('amount_cents', 0)
        if (type === 'income') q = q.lt('amount_cents', 0)

        const { data, error } = await q
        if (error) return JSON.stringify({ error: error.message })
        rows.push(...(data ?? []))
        if ((data?.length ?? 0) < PAGE) break
        offset += PAGE
      }

      const map: Record<string, number> = {}
      for (const t of rows) {
        if (t.is_excluded) continue
        const cat = effectiveCategory(t.user_category, t.category)
        if (cat === 'TRANSFER_IN' || cat === 'TRANSFER_OUT') continue
        map[cat] = (map[cat] ?? 0) + Math.abs(t.amount_cents)
      }

      const result = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, cents]) => ({ category: cat, total: (cents / 100).toFixed(2) }))

      return JSON.stringify({ categories: result })
    }

    if (name === 'sum_by_merchant') {
      const { date_from, date_to, merchant_contains, category, type = 'charges' } = args
      const PAGE = 1000
      const rows: any[] = []
      let offset = 0
      while (true) {
        let q = supabase
          .from('transactions')
          .select('amount_cents, merchant_name, category, user_category, is_excluded')
          .eq('user_id', userId)
          .eq('pending', false)
          .eq('is_internal_transfer', false)
          .range(offset, offset + PAGE - 1)

        if (date_from) q = q.gte('date', date_from)
        if (date_to) q = q.lte('date', date_to)
        if (type === 'charges') q = q.gt('amount_cents', 0)
        if (type === 'income') q = q.lt('amount_cents', 0)
        if (merchant_contains) {
          const kw = merchant_contains.replace(/'/g, "''")
          q = q.or(`merchant_name.ilike.%${kw}%,merchant_normalized.ilike.%${kw}%`)
        }

        const { data, error } = await q
        if (error) return JSON.stringify({ error: error.message })
        rows.push(...(data ?? []))
        if ((data?.length ?? 0) < PAGE) break
        offset += PAGE
      }

      const map: Record<string, number> = {}
      for (const t of rows) {
        if (t.is_excluded) continue
        if (category && effectiveCategory(t.user_category, t.category) !== category) continue
        const vendor = t.merchant_name ?? 'Unknown'
        map[vendor] = (map[vendor] ?? 0) + Math.abs(t.amount_cents)
      }

      const result = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([merchant, cents]) => ({ merchant, total: (cents / 100).toFixed(2) }))

      return JSON.stringify({ merchants: result })
    }

    if (name === 'get_monthly_totals') {
      const { date_from, date_to, category, merchant_contains, type = 'all' } = args
      const PAGE = 1000
      const rows: any[] = []
      let offset = 0
      while (true) {
        let q = supabase
          .from('transactions')
          .select('date, amount_cents, merchant_name, raw_name, category, user_category, is_excluded')
          .eq('user_id', userId)
          .eq('pending', false)
          .eq('is_internal_transfer', false)
          .range(offset, offset + PAGE - 1)

        if (date_from) q = q.gte('date', date_from)
        if (date_to) q = q.lte('date', date_to)
        if (type === 'charges') q = q.gt('amount_cents', 0)
        if (type === 'income') q = q.lt('amount_cents', 0)
        if (merchant_contains) {
          const kw = merchant_contains.replace(/'/g, "''")
          q = q.or(`merchant_name.ilike.%${kw}%,raw_name.ilike.%${kw}%,merchant_normalized.ilike.%${kw}%`)
        }

        const { data, error } = await q
        if (error) return JSON.stringify({ error: error.message })
        rows.push(...(data ?? []))
        if ((data?.length ?? 0) < PAGE) break
        offset += PAGE
      }

      const monthMap: Record<string, { charges: number; income: number }> = {}
      for (const t of rows) {
        if (t.is_excluded) continue
        if (category && effectiveCategory(t.user_category, t.category) !== category) continue
        const cat = effectiveCategory(t.user_category, t.category)
        if (cat === 'TRANSFER_IN' || cat === 'TRANSFER_OUT') continue
        const month = (t.date as string).slice(0, 7)
        if (!monthMap[month]) monthMap[month] = { charges: 0, income: 0 }
        if (t.amount_cents > 0) monthMap[month].charges += t.amount_cents
        else monthMap[month].income += Math.abs(t.amount_cents)
      }

      const result = Object.entries(monthMap)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, v]) => ({
          month,
          charges: (v.charges / 100).toFixed(2),
          income: (v.income / 100).toFixed(2),
        }))

      return JSON.stringify({ months: result })
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` })
  } catch (err: any) {
    return JSON.stringify({ error: err.message })
  }
}

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

  // Fetch previous messages + accounts in parallel
  const [{ data: prevMessages }, { data: accountsData }] = await Promise.all([
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20),
    supabase
      .from('accounts')
      .select('name, official_name, nickname, mask, type, subtype, institution')
      .eq('user_id', user.id),
  ])

  const accountsList = (accountsData ?? [])
    .map((a: any) => `  ${a.nickname ?? a.official_name ?? a.name} (${a.institution}, ${a.subtype}, ···${a.mask})`)
    .join('\n')

  const systemContext = `You are a personal finance assistant for Perry & Karen Sessions. Today is ${today}.

You have tools to query their transaction data on demand — call them as needed to answer accurately. When the question requires current internet data (national averages, benchmarks, news, rates), call request_web_search and we will fetch it for you. You can call finance tools and request_web_search in the same response if both are needed.

CONNECTED ACCOUNTS:
${accountsList}

Amounts: negative = income/credits, positive = charges/outflows. Exclude TRANSFER_IN and TRANSFER_OUT from spending totals. Ignore is_excluded transactions. Format dollars with $ and commas. Use markdown (## headers, **bold**, - bullets).`

  const allTools: any[] = [
    { functionDeclarations: [...FINANCE_TOOLS, WEB_SEARCH_TOOL] },
  ]

  const contents: any[] = [
    { role: 'user', parts: [{ text: systemContext }] },
    { role: 'model', parts: [{ text: 'Understood. I have your accounts, finance query tools, and can request web search when needed.' }] },
    ...(prevMessages ?? []).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    let totalTokens = 0
    let finalText = ''
    // Track finance data gathered during tool calls for injecting into web search call
    const financeResults: { tool: string; result: string }[] = []
    let webSearchNeeded = false

    // Agentic loop — Gemini calls finance tools and/or request_web_search as needed
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await model.generateContent({ contents, tools: allTools })
      totalTokens +=
        (result.response.usageMetadata?.promptTokenCount ?? 0) +
        (result.response.usageMetadata?.candidatesTokenCount ?? 0)

      const candidate = result.response.candidates?.[0]
      const parts = candidate?.content?.parts ?? []
      const fnCalls = parts.filter((p: any) => p.functionCall)

      if (fnCalls.length === 0) {
        finalText = result.response.text()
        break
      }

      // Separate web search signal from real finance tool calls
      const webCall = fnCalls.find((p: any) => p.functionCall.name === 'request_web_search')
      const financeCalls = fnCalls.filter((p: any) => p.functionCall.name !== 'request_web_search')

      if (webCall) webSearchNeeded = true

      if (financeCalls.length > 0) {
        // Execute finance tools, collect results for potential web call context
        const toolResults = await Promise.all(
          financeCalls.map(async (p: any) => {
            const output = await runTool(p.functionCall.name, p.functionCall.args ?? {}, supabase, user.id)
            financeResults.push({ tool: p.functionCall.name, result: output })
            return { functionResponse: { name: p.functionCall.name, response: { output } } }
          }),
        )
        contents.push({ role: 'model', parts })
        contents.push({ role: 'user', parts: toolResults })
      } else if (webSearchNeeded) {
        // Only web search was requested — exit finance loop
        break
      } else {
        // Safety: no callable tools found, stop
        finalText = result.response.text()
        break
      }
    }

    // Second call with googleSearch if AI requested web data
    if (webSearchNeeded && !finalText) {
      const financeContext = financeResults.length > 0
        ? '\n\nFINANCE DATA ALREADY RETRIEVED:\n' +
          financeResults.map(r => `${r.tool}: ${r.result}`).join('\n')
        : ''

      const webContents: any[] = [
        { role: 'user', parts: [{ text: systemContext + financeContext }] },
        { role: 'model', parts: [{ text: 'Understood. I have the finance data and will now search the web.' }] },
        ...(prevMessages ?? []).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ]

      const webResult = await model.generateContent({
        contents: webContents,
        tools: [{ googleSearch: {} } as any],
      })
      totalTokens +=
        (webResult.response.usageMetadata?.promptTokenCount ?? 0) +
        (webResult.response.usageMetadata?.candidatesTokenCount ?? 0)
      finalText = webResult.response.text()
    }

    if (!finalText) {
      return NextResponse.json({ error: 'AI did not return a final answer' }, { status: 500 })
    }

    // Save messages + update session
    await Promise.all([
      supabase.from('chat_messages').insert([
        { session_id: sessionId, role: 'user', content: message },
        { session_id: sessionId, role: 'assistant', content: finalText, tokens_used: totalTokens },
      ]),
      supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId),
    ])

    if (!prevMessages?.length) {
      const title = message.length > 50 ? message.slice(0, 47) + '…' : message
      await supabase.from('chat_sessions').update({ title }).eq('id', sessionId)
    }

    const currentUsed = usage?.tokens_used ?? 0
    const currentReqs = usage?.requests_count ?? 0
    await supabase.from('ai_chat_usage').upsert(
      { user_id: user.id, date: today, tokens_used: currentUsed + totalTokens, requests_count: currentReqs + 1 },
      { onConflict: 'user_id,date' },
    )

    return NextResponse.json({
      reply: finalText,
      session_id: sessionId,
      tokensUsed: totalTokens,
      totalUsed: currentUsed + totalTokens,
      dailyLimit: DAILY_TOKEN_LIMIT,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Gemini error' }, { status: 500 })
  }
}
