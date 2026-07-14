# Money Board

Personal finance dashboard for Perry & Karen Sessions. Next.js 14 app with Supabase auth, Plaid bank sync, Gemini AI categorization, and receipt scanning.

## Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui, light mode only, lucide-react icons
- **Auth/DB:** Supabase (SSR with @supabase/ssr)
- **Bank data:** Plaid API (Chase + Wells Fargo), Production environment
- **AI:** Google Gemini API — use `gemini-2.5-flash` model (free tier works; use wife's Google account key)
- **Charts:** Recharts (pie + line)
- **Email alerts:** Supabase built-in SMTP
- **Deploy:** Vercel (auto-deploys on push to main) — only push when user explicitly asks

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
PLAID_CLIENT_ID
PLAID_SECRET
PLAID_ENV=production
GEMINI_API_KEY               # must be from wife's Google account (AI Studio) — perrysessions@gmail.com account is linked to Google Cloud billing and has limit:0 on free tier for all models
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
  auth/actions.ts                    # login, signup, logout server actions
  auth/confirm/route.ts              # email confirmation callback
  login/page.tsx
  signup/page.tsx
  dashboard/page.tsx                 # overview: stat cards, connected banks, transactions count
  dashboard/transactions/page.tsx    # paginated transaction list with splits, category/subcategory pickers
  dashboard/charts/page.tsx          # pie chart + line chart (Recharts)
  dashboard/limits/page.tsx          # spending limits with category/subcategory/merchant targeting
  dashboard/chat/page.tsx            # AI chat with session history and markdown rendering
  dashboard/receipts/page.tsx        # placeholder (Chunk 6)
  api/plaid/
    create-link-token/route.ts       # creates Plaid Link token
    exchange-token/route.ts          # exchanges public token, handles re-linking
    sync/route.ts                    # syncs all items via transactionsSync cursor, detects internal transfers
  api/accounts/nickname/route.ts     # PATCH — set/clear account nickname
  api/categorize/route.ts            # POST — Gemini AI categorization with merchant cache
  api/transactions/
    category/route.ts                # PATCH — manual category/subcategory override
    [id]/splits/route.ts             # GET list splits, POST create split
    splits/[id]/route.ts             # DELETE split by id
  api/limits/
    route.ts                         # GET list, POST create spending limit
    [id]/route.ts                    # PATCH update, DELETE limit
  api/chat/
    route.ts                         # GET usage, POST send message (multi-turn Gemini with session history)
    sessions/route.ts                # GET list sessions, POST create session
    sessions/[id]/route.ts           # GET messages for session, PATCH title, DELETE session
lib/
  plaid/client.ts                    # Plaid API singleton
  supabase/client.ts                 # browser client
  supabase/server.ts                 # server client (cookies)
  gemini/categorize.ts               # Gemini merchant categorization (gemini-2.5-flash)
  categories.ts                      # PRIMARY_LABELS, SUBCATEGORY_LABELS, formatCategory(), getSubcategoriesForPrimary(), effectiveCategory/Subcategory()
  accounts.ts                        # getAccountDisplayName() utility
middleware.ts
components/
  PlaidLinkButton.tsx                # preloads token on mount, opens synchronously on click
  SyncButton.tsx                     # triggers /api/plaid/sync
  AccountNicknameEditor.tsx          # inline pencil-icon edit
  CategoryPicker.tsx                 # dropdown with custom entry support; blue=user override, gray=AI/Plaid
  SubcategoryPicker.tsx              # dropdown scoped to primary category, with custom entry support
  CategorizeButton.tsx               # calls /api/categorize, shows result/error inline
  BottomNav.tsx                      # 5-tab fixed bottom nav
  ChartsView.tsx                     # client component: pie + line charts with presets
  SpendingLimitsView.tsx             # spending limits CRUD; SubcategorySearch combobox for subcategory type
  ChatView.tsx                       # AI chat: session sidebar, markdown rendering, usage meter
  TransactionSplitButton.tsx         # inline split UI per transaction (scissors button → form)
  TransactionFilters.tsx             # filter bar for transactions page
  UndoBar.tsx                        # undo last category change
  AppHeader.tsx                      # top header with logout
  ui/                                # shadcn: button, input, label, card, badge
```

## Supabase schema (actual, as built)
```sql
plaid_items(id, user_id, access_token, institution_id, institution_name, cursor, last_synced_at)
  -- Migration: ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

accounts(id, user_id, plaid_item_id, plaid_account_id, institution, name, official_name,
         nickname, mask, type, subtype)

transactions(id, user_id, account_id, plaid_transaction_id, date, amount_cents,
             merchant_name, merchant_normalized, category, subcategory, pending,
             ai_category, user_category, user_subcategory, manual_override, is_internal_transfer,
             is_excluded)
  -- is_excluded: user-toggled; hides transaction from all spend calculations (health share bills etc.)
  -- Migration: ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;
  -- category/subcategory = Plaid's personal_finance_category (primary/detailed)
  -- ai_category = Gemini result; user_category/user_subcategory = manual overrides (manual_override=true)

merchant_categories(id, user_id, merchant_normalized, category)
  -- cache: each unique merchant only hits Gemini once ever

spending_limits(id, user_id, label, category, subcategory, merchant_normalized,
                monthly_limit_cents, active)
  -- targeting: set exactly one of category, subcategory, or merchant_normalized
  -- spent_cents calculated server-side in limits/page.tsx at render time

transaction_splits(id, transaction_id, user_id, label, amount_cents, category, subcategory,
                   created_at)
  -- partial splits of a transaction; amount_cents must be > 0 and ≤ transaction total
  -- RLS: users own their splits via user_id

chat_sessions(id, user_id, title, created_at, updated_at)
  -- auto-titled from first message (truncated to 50 chars)
  -- RLS: users own their sessions

chat_messages(id, session_id, role, content, tokens_used, created_at)
  -- role: 'user' | 'assistant'
  -- cascades on session delete
  -- RLS via chat_sessions join

ai_chat_usage(user_id, date, tokens_used, requests_count)
  -- daily token limit: 100,000; upserted per request

receipts(id, user_id, transaction_id nullable, storage_path, uploaded_at)       -- Chunk 6
receipt_items(id, receipt_id, description, amount_cents, ai_category, manual_override)
```

## Key logic / gotchas
- **Chase re-linking:** Chase rotates plaid_account_id on every re-link. Match accounts by institution+mask+type, not plaid_account_id. Delete old plaid_items by institution_id+user_id before inserting new one.
- **Internal transfer detection:** After each sync, reset all TRANSFER_IN/OUT flags, re-match TRANSFER_OUT (positive) with TRANSFER_IN (negative) across different accounts with same amount within 2 days → is_internal_transfer=true. Handles $1,300/month Chase→Wells transfer.
- **Spending calc:** Exclude pending=true, is_internal_transfer=true, amount_cents≤0. Total spend = all outflows. CC spend = type='credit' outflows. Cash out = type='depository' outflows.
- **Gemini quota:** Use `gemini-2.5-flash`. perrysessions@gmail.com Google account is on paid Cloud billing with $0 credits — always use wife's account API key. merchant_categories table caches results so each merchant only hits Gemini once.
- **PlaidLinkButton:** Must preload token on mount (not on click) to avoid popup blocker. Call open() synchronously in the click handler.
- **Plaid history:** Chase/Wells Fargo only provide ~3 months of transaction history via Plaid API regardless of what's requested. Historical data before that requires CSV import (planned Chunk 7).
- **Spending limits spent_cents:** Calculated server-side in `dashboard/limits/page.tsx` at render time — builds categorySpend/subcategorySpend/merchantSpend maps from current-month transactions. After save/edit in SpendingLimitsView, call `window.location.reload()` (not optimistic update) to show correct server-calculated value.
- **Subcategory keys:** Plaid uses keys like `FOOD_AND_DRINK_RESTAURANT` (not `RESTAURANTS`). All known keys are in `lib/categories.ts` SUBCATEGORY_LABELS. `formatCategory()` returns custom user labels as-is (bypasses the underscore→titlecase transform for non-Plaid strings).
- **AI chat multi-turn:** Uses `model.generateContent({ contents: [...] })` with full history array (not `startChat()`). System context injected as first user/model exchange. Last 20 messages fetched per session.
- **SubcategorySearch in limits:** Uses `<button type="button">` trigger (not div) so it appears in browser accessibility tree and click events fire reliably.

## Chunk plan
- [x] **Chunk 1** — Scaffold, Supabase auth, passcode gate, Vercel deploy ✅
- [x] **Chunk 2** — Plaid Production, Chase + Wells Fargo connected, transaction sync, internal transfer detection, account nicknames ✅
- [x] **Chunk 3** — Gemini AI categorization, merchant cache, manual override, transactions page, bottom nav ✅
- [x] **Chunk 4** — Charts: pie by category (with toggle-off, persisted in localStorage) + line trend with presets (30D/3M/6M/1Y/2Y/All) ✅
- [x] **Chunk 5** — Spending limits: category/subcategory/merchant targeting, progress bars, pause/resume, subcategory combobox search ✅
- [x] **Chunk 5b** — Transaction splits (inline split form per transaction), AI chat session history + markdown rendering, custom category/subcategory entry ✅
- [ ] **Chunk 6** — Receipt scanner (photo + PDF → Gemini Vision → itemized line items)
- [ ] **Chunk 7** — CSV statement import for historical data (Chase + Wells Fargo export CSVs; AI maps columns → schema; fills in pre-Plaid history)

## Design rules
- Light mode only, never dark
- Tailwind utility classes, minimal custom CSS
- Mobile-first (portrait phone is primary), also works on desktop
- Inputs: h-12, rounded-xl, text-base (finger-friendly)
- Cards: border border-gray-100 shadow-md rounded-2xl
- Primary color: blue-600
- No emojis in UI
