# Money Board

Personal finance dashboard for Perry & Karen Sessions. Next.js 14 app with Supabase auth, Plaid bank sync, Gemini AI categorization, and receipt scanning.

## Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui, light mode only, lucide-react icons
- **Auth/DB:** Supabase (SSR with @supabase/ssr)
- **Bank data:** Plaid API (Chase + Wells Fargo)
- **AI:** Google Gemini API (categorization + receipt OCR)
- **Email alerts:** Supabase built-in SMTP
- **Deploy:** Vercel (auto-deploys on push to main)

## URLs
- **Local:** http://localhost:3001
- **Production:** https://money-board.vercel.app
- **GitHub:** https://github.com/perrysessions/MoneyBoard
- **Supabase project:** https://gklcmularwshsrqpsdeq.supabase.co

## Running locally
```bash
cd /Users/perrysessions/ClaudeAICode/money-board
npm run dev
```
Dev server runs on port 3001. Launch via `.claude/launch.json` name: `money-board`.

## Env vars
All in `.env.local` (gitignored). Also set in Vercel dashboard.
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SIGNUP_PASSCODE=2356         # required at signup, server-side checked
PLAID_CLIENT_ID              # not yet added — Chunk 2
PLAID_SECRET                 # not yet added — Chunk 2
PLAID_ENV=sandbox            # sandbox → production later
GEMINI_API_KEY               # not yet added — Chunk 3
ALERT_EMAIL_TO=perrysessions@gmail.com,karensessions21@gmail.com
```

## Auth
- Supabase email/password auth with email confirmation
- Signup requires passcode `2356` (checked in server action, not just client)
- Middleware at `middleware.ts` protects all routes, redirects to `/login`
- Email confirm callback: `/auth/confirm/route.ts`
- Admin account: perrysessions@gmail.com

## Supabase setup notes
- Email confirmation redirect URLs must include both:
  - `http://localhost:3001/auth/confirm`
  - `https://money-board.vercel.app/auth/confirm`
- Uses new Supabase API key format (sb_publishable_ / sb_secret_), not legacy JWT keys

## Project structure
```
app/
  auth/actions.ts          # login, signup, logout server actions
  auth/confirm/route.ts    # email confirmation callback
  login/page.tsx
  signup/page.tsx
  dashboard/page.tsx       # shell only — charts come in Chunk 4
lib/supabase/
  client.ts                # browser client
  server.ts                # server client (cookies)
middleware.ts              # auth route protection
components/ui/             # shadcn: button, input, label, card, badge
```

## Chunk plan
- [x] **Chunk 1** — Scaffold, Supabase auth, passcode gate, Vercel deploy ✅
- [ ] **Chunk 2** — Plaid bank connection (Chase + Wells Fargo), transaction sync to DB
- [ ] **Chunk 3** — Gemini AI categorization engine + manual override UI
- [ ] **Chunk 4** — Dashboard charts (Recharts): line chart by category, donut by month, transaction list
- [ ] **Chunk 5** — Spending limits UI + Supabase email alerts to both users
- [ ] **Chunk 6** — Receipt scanner (photo + PDF → Gemini Vision → itemized line items)

## Supabase schema (planned — not yet created)
```sql
-- Chunk 2
accounts(id, user_id, plaid_account_id, institution, type, name)
transactions(id, user_id, account_id, date, amount_cents, merchant_name, merchant_normalized, category, subcategory, account_type, plaid_transaction_id, manual_override)

-- Chunk 5
spending_limits(id, user_id, label, category, merchant_normalized, monthly_limit_cents, active)

-- Chunk 6
receipts(id, user_id, transaction_id nullable, storage_path, uploaded_at)
receipt_items(id, receipt_id, description, amount_cents, ai_category, manual_override)
```

## Design rules
- Light mode only, never dark
- Tailwind utility classes, minimal custom CSS
- Mobile-first (portrait phone is primary), also works on desktop
- Inputs: h-12, rounded-xl, text-base (finger-friendly)
- Cards: border border-gray-100 shadow-md rounded-2xl
- Primary color: blue-600
- No emojis in UI
