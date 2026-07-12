import { GoogleGenerativeAI } from '@google/generative-ai'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' })

export const CATEGORIES = [
  'Groceries',
  'Dining',
  'Gas & Fuel',
  'Shopping',
  'Entertainment',
  'Travel',
  'Healthcare',
  'Utilities',
  'Mortgage & Rent',
  'Subscriptions',
  'Personal Care',
  'Home & Garden',
  'Auto',
  'Pets',
  'Education',
  'Gifts & Donations',
  'Business Services',
  'Other',
] as const

export type Category = typeof CATEGORIES[number]

// One Gemini call for all merchants. Returns { merchant_normalized: category }
export async function categorizeMerchants(
  merchants: string[]
): Promise<Record<string, Category>> {
  if (!merchants.length) return {}

  const prompt = `You are categorizing personal finance transactions.
Given these merchant names, assign each one a category from this list:
${CATEGORIES.join(', ')}

Merchants (JSON array):
${JSON.stringify(merchants)}

Rules:
- Reply ONLY with a valid JSON object mapping each merchant name exactly as given to its category
- Every merchant must have a category
- Use "Other" if unsure
- Do not include any explanation, markdown, or extra text

Example format:
{"walmart supercenter": "Groceries", "netflix": "Subscriptions"}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  // Strip markdown code fences if Gemini wraps the JSON
  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    return JSON.parse(json)
  } catch {
    // Best-effort: try to extract JSON object from response
    const match = json.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return {}
  }
}
