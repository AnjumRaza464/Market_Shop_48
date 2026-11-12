# Market 48 Shop

Management system for a fruit & vegetable **commission (aarhat) shop** with two khatas:

* **Supplier parties (maal lene wali parties)** – beoparis whose goods you sell on commission: daily
  gari/patti settlement with automatic commission and expense deductions, payments, advances, statements.
* **Customer parties (maal dene wali parties)** – buyers you supply goods to on udhaar: one-row khata
  entries (goods given and/or cash received), running balances, dues, day/month/year reports.

Plus shop expense tracking with partner settlement, a **cash book (cash in hand)** derived from all of
the above, and profit reports. The three reference
spreadsheets the system was modelled on are in the project root (`FINAL----Fruit_Market_Ledger…`,
`V-1-Khaata_Sheet…`, `V-1-Shop_Expense_Sheet…`); see section 3 for the mapping.

Built with **Next.js 16 (App Router, Cache Components, Server Actions)**, **Neon PostgreSQL**,
**Drizzle ORM**, **Zod v4**, **decimal.js** and **Tailwind CSS v4**.

---

## 1. Quick start

### Prerequisites

| Tool    | Version                               |
| ------- | ------------------------------------- |
| Node.js | 22 or newer (24 LTS recommended)      |
| npm     | 10+                                   |
| Neon    | A free project at https://neon.tech   |

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    → paste your Neon *pooled* connection string into DATABASE_URL
#    → login defaults to admin / 123123 – set APP_USERNAME, APP_PASSWORD and AUTH_SECRET to change it

# 3. Create the tables in Neon (runs drizzle/0000_*.sql and records it)
npm run db:migrate

# 4. (Optional) load realistic demo data – 8 suppliers, ~300 bills, 10 customers, ~390 khata
#    entries, expenses and 2 partners for 2026. Seeds only the modules whose tables are empty.
npm run db:seed

# 5. Run
npm run dev          # http://localhost:3000
```

### All scripts

| Script                | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `npm run dev`         | Start the dev server (Turbopack)                                    |
| `npm run build`       | Production build                                                    |
| `npm run start`       | Serve the production build                                          |
| `npm run typecheck`   | Generate route types and run `tsc --noEmit`                         |
| `npm run lint`        | ESLint                                                              |
| `npm test`            | Vitest unit tests (money math, patti calculation, validation)       |
| `npm run db:generate` | Create a new SQL migration from `db/schema.ts`                      |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL`                          |
| `npm run db:push`     | Push the schema directly (prototyping only; prefer migrations)      |
| `npm run db:studio`   | Browse the database with Drizzle Studio                             |
| `npm run db:seed`     | Seed demo data for empty modules (`-- --force` wipes everything and re-seeds; `-- --wipe` empties every table without demo data; `-- --reset-customers` / `-- --reset-partners` wipe one module) |
| `npm run db:verify`   | Read-only integrity audit of the live database (bill math, ledger postings, customer balances) |

### Environment variables

| Variable                      | Required | Purpose                                                                 |
| ----------------------------- | -------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                | yes      | Neon connection string (pooled host, `sslmode=require`)                 |
| `APP_USERNAME`                | no       | Login username (default `admin`)                                        |
| `APP_PASSWORD`                | no       | Login password (default `123123`) – change before going live            |
| `AUTH_SECRET`                 | no       | ≥16 random chars (falls back to a derived secret with a warning); signs the session cookie (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `NEXT_PUBLIC_SHOP_NAME`       | no       | Printed on pattis, statements and the sidebar                           |
| `NEXT_PUBLIC_SHOP_ADDRESS`    | no       | Printed on pattis and statements                                        |
| `NEXT_PUBLIC_SHOP_PHONE`      | no       | Printed on pattis and statements                                        |
| `NEXT_PUBLIC_CURRENCY_SYMBOL` | no       | Default `Rs`                                                            |
| `APP_TIMEZONE`                | no       | IANA zone for "today" defaults (default `Asia/Karachi`)                 |

---

## 2. Deploying to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket and import it in Vercel (framework: Next.js).
2. Add the environment variables above in **Project → Settings → Environment Variables**
   (or install the Neon integration from the Vercel Marketplace, which sets `DATABASE_URL` for you).
3. Run `npm run db:migrate` once against the production database (locally with the production
   `DATABASE_URL`, or as a one-off CI step).
4. Deploy. Every page streams from Node.js functions; nothing is cached server-side, so the khata
   is always live.

---

## 3. Business logic

### How the three spreadsheets map onto the app

| Spreadsheet                                   | Sheet                      | In the app                                                            |
| --------------------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| Fruit Market Ledger (suppliers, commission)   | Parties                    | Supplier Parties (`/parties`) – mobile, market, main items, opening, commission % |
|                                               | Ledger / Bill Summary      | Bills / Pattis (`/bills`) – one line per size, commission + kiraya + mazdoori + other, net payable |
|                                               | Bill View                  | Patti page + print (`/bills/[id]`, `/print/bills/[id]`)              |
|                                               | Party Statement            | Party ledger with date range and month-wise khata (`/parties/[id]`)  |
|                                               | Party Summary / Yearly     | Supplier Summary (`/reports/parties`) – lifetime, any year or custom period with opening/closing |
|                                               | Profit Report              | Profit & Loss (`/reports`) – commission month/year-wise with kiraya/mazdoori/other breakdown |
| Khaata Sheet (customers, udhaar)              | Parties                    | Customer Parties (`/customers`) – phone, mandi/city, opening, totals, closing, last entry, Due/Advance/Clear |
|                                               | Entries                    | Khata Entries (`/sales`) – date, customer, item, qty, rate, amount, received, mode, bill no; filtered totals |
|                                               | Party Ledger               | Customer khata with From–To, balance before period, running balance, print (`/customers/[id]`) |
|                                               | Summary / Monthly          | Sales & Dues report (`/reports/sales`) – outstanding, top dues, day report, month-wise, year-wise, customer-wise period, item-wise |
| Shop Expense Sheet                            | Daily Expenses             | Shop Expenses (`/expenses`) – category, amount, paid by (partner / cash box), mode, notes |
| –                                             | Cash book (roznamcha)      | Cash in Hand (`/cash`) – running balance per account, period in/out by source, manual opening / deposit / withdrawal / transfer |
|                                               | Monthly / Month-wise / Year-wise | Expenses page (period filters, totals, daily average, biggest category) + Expense Reports (`/reports/expenses`) |
|                                               | Settings → Partners        | Partners (`/partners`) with share %; Partner settlement on expenses page and expense report |

### Customer khata (udhaar) sign convention

| Entry column        | Side   | Meaning                                       |
| ------------------- | ------ | --------------------------------------------- |
| Amount (qty × rate) | Debit  | Goods given – the customer owes more          |
| Received            | Credit | Cash / bank received from the customer        |

`balance = opening balance + Σ amount − Σ received`

* **Balance > 0 (Dr)** → due from the customer.
* **Balance < 0 (Cr)** → the customer has paid in advance.
* A row may hold goods only, cash only, or both (exactly like the Khaata sheet).

### Supplier party khata (ledger) sign convention

| Entry                     | Side   | Meaning                                       |
| ------------------------- | ------ | --------------------------------------------- |
| Bill (patti) net amount   | Credit | Shop owes the party for goods sold            |
| Payment to party          | Debit  | Shop paid the party                           |
| Advance to party          | Debit  | Party owes the shop (money given upfront)     |
| Receipt from party        | Credit | Party paid money to the shop                  |
| Adjustment                | either | Manual correction                             |

`balance = opening balance + Σ credit − Σ debit`

* **Balance > 0 (Cr)** → payable to the party.
* **Balance < 0 (Dr)** → receivable from the party (advance outstanding).

### Patti (bill) calculation – `lib/calc.ts`

```
line amount     = quantity × rate                          (half-up to 2 dp)
gross amount    = Σ line amounts
commission      = gross × commission % / 100               (half-up to 2 dp)
total expenses  = freight (kiraya) + labour (mazdoori) + market fee + munshiyana + other
net amount      = gross − commission − total expenses      → credited to the party ledger
final payable   = net amount − advance adjusted            → cash handed over now
```

The advance was already debited when it was given, so crediting the **net amount** (not the final
payable) keeps the ledger consistent; the advance adjustment is shown on the patti for the party.

### Bill lifecycle

| Status      | Ledger                                   | Allowed actions                            |
| ----------- | ---------------------------------------- | ------------------------------------------ |
| `PENDING`   | BILL credit posted                       | Edit, Mark paid, Cancel, Delete            |
| `PAID`      | BILL credit + PAYMENT debit              | Undo payment, Print                        |
| `CANCELLED` | no ledger entries                        | Restore, Delete                            |

All bill writes (bill + line items + ledger entry) run inside one database transaction.

### Cash in hand (cash book)

Nothing is typed twice: the cash book (`/cash`) is a UNION of every money movement already
recorded elsewhere, grouped by payment mode, so **cash in hand = the CASH mode balance**:

| Movement                                  | Side | Source table                                |
| ----------------------------------------- | ---- | ------------------------------------------- |
| Received from a customer                  | In   | `sale_entries.received`                     |
| Received from a supplier (RECEIPT)        | In   | `party_transactions.credit`                 |
| Paid / advanced to a supplier             | Out  | `party_transactions.debit` (PAYMENT, ADVANCE – includes “Mark paid” on a patti) |
| Shop expense paid from the cash box       | Out  | `shop_expenses` where `paid_by_partner_id IS NULL` |
| Opening cash, deposits, withdrawals, transfers between accounts, adjustments | either | `cash_entries` (manual, entered on the Cash page) |

Bank / JazzCash / Easypaisa / cheque movements are tracked the same way under their own mode, so
the page also shows “Bank & digital” and a per-account breakdown. A **Transfer** entry moves money
out of one account and into another (e.g. cash deposited at the bank). Start by recording an
**Opening cash** entry so the balance matches the physical cash box; expenses a partner paid from
their own pocket do not touch the shop's cash.

### Profit & loss

`profit = commission earned − shop expenses`. Bill expenses (freight, labour, market fee,
munshiyana) are deducted from parties and passed on, so they are reported for reference only.
Goods supplied to customers are tracked as receivables (the Khaata sheet records no cost price), so
they do not enter the profit statement.

### Partner settlement

Each shop expense is either paid from the **shop cash box** or by a **partner**. For any period:
`share = total expenses × partner share %`, `balance = paid by partner − share`. Positive = the partner
should receive from the others, negative = the partner should pay.

### Money handling

Every amount is stored as `NUMERIC(14,2)` and travels through the app as a **string**. All
arithmetic uses `decimal.js` with `ROUND_HALF_UP`; no JavaScript floats touch currency. Inputs are
validated with Zod regexes (max 2 decimals for money, 3 for quantities) before they reach the
calculator.

---

## 4. Database schema (`db/schema.ts`)

| Table                | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `parties`            | Supplier party master: contact, market, main items, commission %, opening balance, default freight/labour, status |
| `bills`              | One patti per gari: gross, commission %, commission, each expense, totals, advance adjusted, final payable, status |
| `bill_items`         | Line items of a bill (item, size/dana, quantity, unit, rate, amount) – cascade on delete |
| `party_transactions` | Supplier ledger: date, type, debit, credit, description, `reference_id` → bill, payment mode |
| `customers`          | Customer party master: contact, mandi/city, opening balance (+ due / − advance), status |
| `sale_entries`       | Customer khata rows: date, item, qty, unit, rate, amount (debit), received (credit), payment mode, reference, remarks |
| `partners`           | Shop partners with share % for expense settlement                          |
| `shop_expenses`      | Date, category, amount, payment mode, `paid_by_partner_id` (null = shop cash box), notes |

Enums: `party_status`, `bill_status`, `transaction_type`, `payment_mode` (cash, bank, JazzCash,
Easypaisa, cheque, other), `expense_category` (24 categories). Indexes cover names/status, bill
party/date/status, ledgers (party/customer, date), expense date/category/partner. CHECK constraints keep
percentages within 0–100, amounts non-negative and forbid empty khata rows.

The generated SQL lives in `drizzle/0000_*.sql` and `drizzle/0001_*.sql`; the journal in `drizzle/meta/` tracks what has been applied.

---

## 5. Project structure

```
app/
  layout.tsx                 root layout (fonts, metadata)
  (app)/                     authenticated shell with sidebar
    page.tsx                 dashboard
    bills/                   list · new · [id] (patti view + settle) · [id]/edit
    parties/                 supplier list · new · [id] (ledger/statement + month-wise) · [id]/edit
    transactions/            payments & advances list · new
    customers/               customer list · new · [id] (khata + quick entry) · [id]/edit
    sales/                   customer khata entries: quick entry + filtered list · [id]/edit
    expenses/                quick entry + list + partner settlement · [id]/edit
    partners/                partner list + add · [id]/edit
    reports/                 profit & loss · parties (supplier summary) · sales (dues, day/month/year) · expenses
  (print)/print/             printable patti, supplier statement and customer khata (no sidebar)
  login/                     sign-in screen (username + password, default admin / 123123)
components/
  ui/                        buttons, inputs, cards, tables, badges, stat tiles, confirm button…
  forms/                     bill form (live totals, keyboard flow), party, customer, sale entry, transaction, expense, partner
  print/                     PattiDocument, StatementDocument, CustomerStatementDocument, print toolbar
  reports/                   PartnerSettlementTable
  charts/bar-chart.tsx       SVG grouped column chart with hover tooltips
db/                          Drizzle schema + Neon client
lib/
  calc.ts                    patti calculation (pure)
  money.ts                   decimal helpers + en-IN formatting
  dates.ts / periods.ts      ISO date helpers, report years 2025–2035, period presets
  validation/                Zod schemas + FormData parsing
  queries/                   read models (server-only)
  actions/                   Server Actions (mutations)
  auth.ts                    HMAC session cookie helpers
proxy.ts                     route gate – every page needs a valid session cookie
scripts/seed.ts              demo data generator (module-wise, additive)
scripts/verify.ts            read-only database integrity audit (npm run db:verify)
tests/                       Vitest unit tests
```

### How data flows

* **Reads** happen in async Server Components wrapped in `<Suspense>` (required by Cache
  Components so the static shell streams instantly). Nothing is cached, so every page shows the
  live ledger.
* **Writes** are Server Actions in `lib/actions/*`. Each one re-checks the session, validates with
  Zod, performs the mutation (transactions where several rows change together), then calls
  `refresh()` or redirects.
* **Forms** are client components with controlled inputs so values survive validation errors.
  Enter moves to the next field, Ctrl+Enter saves, Enter on the last rate adds an item line.

---

## 6. Keyboard-first data entry

| Key                       | Effect                                             |
| ------------------------- | -------------------------------------------------- |
| `Tab` / `Enter`           | Next field (Enter never submits accidentally)      |
| `Enter` on last item rate | Adds a new item line and focuses it                |
| `Ctrl` + `Enter`          | Save the form                                      |
| Number inputs             | Numeric keypad on mobile, select-all on focus      |

---

## 7. Printing

* Bill page → **Print patti** opens `/print/bills/[id]?auto=1`, which triggers the browser print
  dialog (save as PDF from there). A4 page size and margins are set in `app/globals.css`.
* Party ledger → **Print statement** prints the filtered date range.
* Reports have a **Print report** button; the sidebar and controls are hidden in print.
