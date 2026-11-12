import "server-only";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cashEntries, type CashEntry, type PaymentMode } from "@/db/schema";
import { CASH_SOURCES, PAGE_SIZE, PAYMENT_MODES, type CashSource } from "@/lib/constants";
import { D, toMoneyString, ZERO } from "@/lib/money";

/**
 * Every cash movement in the shop as one UNION (the "cash book"). Nothing here is stored twice:
 * customer receipts, supplier payments and expenses come straight from their own tables and the
 * manual rows come from `cash_entries`, so the balance can never drift from the khatas.
 *
 * Columns: source, source_id, d (date), seq (tie-break), mode, cash_in, cash_out, who, who_id, bill_id, note
 */
const MOVES: SQL = sql`
  select 'CUSTOMER_RECEIPT'::text as source, se.id as source_id, se.entry_date as d, 1 as seq,
         coalesce(se.payment_mode, 'CASH')::payment_mode as mode,
         se.received as cash_in, 0::numeric as cash_out,
         c.name::text as who, se.customer_id as who_id, null::int as bill_id, se.remarks as note
    from sale_entries se
    join customers c on c.id = se.customer_id
   where se.received > 0
  union all
  select 'PARTY_RECEIPT', pt.id, pt.txn_date, 2, coalesce(pt.payment_mode, 'CASH')::payment_mode,
         pt.credit, 0, p.name, pt.party_id, pt.reference_id, pt.description
    from party_transactions pt
    join parties p on p.id = pt.party_id
   where pt.type = 'RECEIPT' and pt.credit > 0
  union all
  select case when pt.type = 'ADVANCE' then 'PARTY_ADVANCE' else 'PARTY_PAYMENT' end, pt.id, pt.txn_date, 3,
         coalesce(pt.payment_mode, 'CASH')::payment_mode,
         0, pt.debit, p.name, pt.party_id, pt.reference_id, pt.description
    from party_transactions pt
    join parties p on p.id = pt.party_id
   where pt.type in ('PAYMENT', 'ADVANCE') and pt.debit > 0
  union all
  select 'EXPENSE', e.id, e.expense_date, 4, e.payment_mode,
         0, e.amount, e.category::text, null, null, e.notes
    from shop_expenses e
   where e.paid_by_partner_id is null
  union all
  select case when ce.type = 'TRANSFER' then 'TRANSFER_OUT' else ce.type::text end, ce.id, ce.entry_date, 5, ce.payment_mode,
         case when ce.direction = 'IN' then ce.amount else 0 end,
         case when ce.direction = 'OUT' then ce.amount else 0 end,
         pr.name, ce.partner_id, null, ce.notes
    from cash_entries ce
    left join partners pr on pr.id = ce.partner_id
  union all
  select 'TRANSFER_IN', ce.id, ce.entry_date, 6, ce.to_mode,
         ce.amount, 0, null, null, null, ce.notes
    from cash_entries ce
   where ce.type = 'TRANSFER'
`;

export interface CashBookFilters {
  from?: string;
  to?: string;
  mode?: PaymentMode;
  source?: CashSource;
  page?: number;
}

function conditions(f: Omit<CashBookFilters, "page">): SQL {
  const parts: SQL[] = [sql`true`];
  if (f.from) parts.push(sql`m.d >= ${f.from}::date`);
  if (f.to) parts.push(sql`m.d <= ${f.to}::date`);
  if (f.mode) parts.push(sql`m.mode = ${f.mode}::payment_mode`);
  if (f.source) parts.push(sql`m.source = ${f.source}`);
  return sql.join(parts, sql` and `);
}

type Row = Record<string, unknown>;
async function run(query: SQL): Promise<Row[]> {
  const result = await db.execute(query);
  return result.rows as Row[];
}

// ---------- Position (cash in hand right now) ----------
export interface ModeBalance {
  mode: PaymentMode;
  cashIn: string;
  cashOut: string;
  balance: string;
}

export interface CashPosition {
  /** Balance of the CASH mode – the physical cash box. */
  cashInHand: string;
  /** Bank + JazzCash + Easypaisa + cheque + other. */
  bankAndDigital: string;
  total: string;
  byMode: ModeBalance[];
  /** True when at least one OPENING entry exists – otherwise the balance may look wrong / negative. */
  hasOpening: boolean;
}

/** Cash in hand = Σ in − Σ out of every movement ever recorded, per payment mode. */
export async function getCashPosition(): Promise<CashPosition> {
  const [rows, [opening]] = await Promise.all([
    run(sql`
      with moves as (${MOVES})
      select m.mode::text as mode, coalesce(sum(m.cash_in), 0)::text as cash_in, coalesce(sum(m.cash_out), 0)::text as cash_out
        from moves m
       group by m.mode
    `),
    db.select({ n: sql<number>`count(*)::int` }).from(cashEntries).where(eq(cashEntries.type, "OPENING")),
  ]);

  const byMode: ModeBalance[] = PAYMENT_MODES.map((m) => {
    const r = rows.find((x) => x.mode === m.value);
    const cashIn = D(r?.cash_in as string | undefined);
    const cashOut = D(r?.cash_out as string | undefined);
    return { mode: m.value, cashIn: toMoneyString(cashIn), cashOut: toMoneyString(cashOut), balance: toMoneyString(cashIn.minus(cashOut)) };
  });
  const cash = D(byMode.find((m) => m.mode === "CASH")?.balance);
  const others = byMode.filter((m) => m.mode !== "CASH").reduce((acc, m) => acc.plus(D(m.balance)), ZERO);

  return {
    cashInHand: toMoneyString(cash),
    bankAndDigital: toMoneyString(others),
    total: toMoneyString(cash.plus(others)),
    byMode,
    hasOpening: Number(opening?.n ?? 0) > 0,
  };
}

// ---------- Period summary (cash in / cash out by source) ----------
export interface CashSourceTotal {
  source: CashSource;
  label: string;
  side: "IN" | "OUT" | "BOTH";
  cashIn: string;
  cashOut: string;
  count: number;
}

export interface CashFlowSummary {
  cashIn: string;
  cashOut: string;
  net: string;
  /** Balance (all modes, or the filtered mode) before the first day of the range. */
  opening: string;
  /** opening + net */
  closing: string;
  bySource: CashSourceTotal[];
}

export async function getCashFlowSummary(filters: Omit<CashBookFilters, "page" | "source"> = {}): Promise<CashFlowSummary> {
  const [rows, [openingRow]] = await Promise.all([
    run(sql`
      with moves as (${MOVES})
      select m.source, count(*)::int as n, coalesce(sum(m.cash_in), 0)::text as cash_in, coalesce(sum(m.cash_out), 0)::text as cash_out
        from moves m
       where ${conditions(filters)}
       group by m.source
    `),
    filters.from
      ? run(sql`
          with moves as (${MOVES})
          select coalesce(sum(m.cash_in - m.cash_out), 0)::text as bal
            from moves m
           where ${conditions({ to: undefined, mode: filters.mode })} and m.d < ${filters.from}::date
        `)
      : Promise.resolve([{ bal: "0" } as Row]),
  ]);

  const bySource = CASH_SOURCES.map((s) => {
    const r = rows.find((x) => x.source === s.value);
    return {
      source: s.value,
      label: s.label,
      side: s.side,
      cashIn: toMoneyString(r?.cash_in as string | undefined),
      cashOut: toMoneyString(r?.cash_out as string | undefined),
      count: Number(r?.n ?? 0),
    };
  }).filter((s) => s.count > 0);

  const cashIn = bySource.reduce((acc, s) => acc.plus(D(s.cashIn)), ZERO);
  const cashOut = bySource.reduce((acc, s) => acc.plus(D(s.cashOut)), ZERO);
  const opening = D(openingRow?.bal as string | undefined);
  const net = cashIn.minus(cashOut);

  return {
    cashIn: toMoneyString(cashIn),
    cashOut: toMoneyString(cashOut),
    net: toMoneyString(net),
    opening: toMoneyString(opening),
    closing: toMoneyString(opening.plus(net)),
    bySource,
  };
}

// ---------- Cash book (ledger with running balance) ----------
export interface CashBookRow {
  source: CashSource;
  /** Id in the source table (sale entry / party transaction / expense / cash entry). */
  sourceId: number;
  date: string;
  mode: PaymentMode;
  cashIn: string;
  cashOut: string;
  /** Customer / supplier / partner name, or the expense category for expenses. */
  who: string | null;
  whoId: number | null;
  billId: number | null;
  note: string | null;
  balance: string;
}

export interface CashBookResult {
  rows: CashBookRow[];
  total: number;
  page: number;
  pageSize: number;
  opening: string;
  totals: { cashIn: string; cashOut: string };
  closing: string;
}

/** Chronological cash book with a running balance (opening = balance before `from`). */
export async function listCashBook(filters: CashBookFilters = {}): Promise<CashBookResult> {
  const page = Math.max(1, filters.page ?? 1);
  const where = conditions(filters);
  const openingWhere = sql`${conditions({ mode: filters.mode, source: filters.source })} and ${filters.from ? sql`m.d < ${filters.from}::date` : sql`false`}`;

  const [[openingRow], [totalsRow], rows] = await Promise.all([
    run(sql`
      with moves as (${MOVES})
      select coalesce(sum(m.cash_in - m.cash_out), 0)::text as bal from moves m where ${openingWhere}
    `),
    run(sql`
      with moves as (${MOVES})
      select count(*)::int as n, coalesce(sum(m.cash_in), 0)::text as cash_in, coalesce(sum(m.cash_out), 0)::text as cash_out
        from moves m where ${where}
    `),
    run(sql`
      with moves as (${MOVES}),
           filtered as (select m.* from moves m where ${where}),
           running as (
             select f.*, sum(f.cash_in - f.cash_out) over (order by f.d, f.seq, f.source_id rows between unbounded preceding and current row) as cum
               from filtered f
           )
      select r.source, r.source_id, r.d::text as d, r.mode::text as mode, r.cash_in::text as cash_in, r.cash_out::text as cash_out,
             r.who, r.who_id, r.bill_id, r.note, r.cum::text as cum
        from running r
       order by r.d, r.seq, r.source_id
       limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
    `),
  ]);

  const opening = D(openingRow?.bal as string | undefined);
  const cashIn = D(totalsRow?.cash_in as string | undefined);
  const cashOut = D(totalsRow?.cash_out as string | undefined);

  return {
    rows: rows.map((r) => ({
      source: r.source as CashSource,
      sourceId: Number(r.source_id),
      date: String(r.d),
      mode: r.mode as PaymentMode,
      cashIn: toMoneyString(r.cash_in as string),
      cashOut: toMoneyString(r.cash_out as string),
      who: (r.who as string | null) ?? null,
      whoId: r.who_id === null || r.who_id === undefined ? null : Number(r.who_id),
      billId: r.bill_id === null || r.bill_id === undefined ? null : Number(r.bill_id),
      note: (r.note as string | null) ?? null,
      balance: toMoneyString(opening.plus(D(r.cum as string))),
    })),
    total: Number(totalsRow?.n ?? 0),
    page,
    pageSize: PAGE_SIZE,
    opening: toMoneyString(opening),
    totals: { cashIn: toMoneyString(cashIn), cashOut: toMoneyString(cashOut) },
    closing: toMoneyString(opening.plus(cashIn).minus(cashOut)),
  };
}

// ---------- Manual entries ----------
export async function getCashEntry(id: number): Promise<CashEntry | undefined> {
  return db.query.cashEntries.findFirst({ where: eq(cashEntries.id, id) });
}

export interface MonthlyCashRow {
  month: number;
  cashIn: string;
  cashOut: string;
}

/** Month-wise cash in / cash out for one year (all modes). */
export async function getCashMonthly(year: number): Promise<MonthlyCashRow[]> {
  const rows = await run(sql`
    with moves as (${MOVES})
    select extract(month from m.d)::int as month, coalesce(sum(m.cash_in), 0)::text as cash_in, coalesce(sum(m.cash_out), 0)::text as cash_out
      from moves m
     where extract(year from m.d) = ${year}
     group by 1
  `);
  return Array.from({ length: 12 }, (_, i) => {
    const r = rows.find((x) => Number(x.month) === i + 1);
    return { month: i + 1, cashIn: toMoneyString(r?.cash_in as string | undefined), cashOut: toMoneyString(r?.cash_out as string | undefined) };
  });
}
