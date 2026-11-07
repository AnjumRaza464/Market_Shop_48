import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lte, max, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, saleEntries, type PaymentMode, type SaleEntry } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { REPORT_YEARS, yearRange } from "@/lib/dates";
import { D, toMoneyString, toQtyString, ZERO } from "@/lib/money";

export interface SaleListFilters {
  q?: string;
  customerId?: number;
  item?: string;
  paymentMode?: PaymentMode;
  /** GOODS = rows with goods, RECEIPTS = rows with cash received. */
  kind?: "GOODS" | "RECEIPTS";
  from?: string;
  to?: string;
  page?: number;
}

export interface SaleListRow extends SaleEntry {
  customerName: string;
}

export interface SaleListResult {
  rows: SaleListRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { qty: string; debit: string; credit: string; net: string };
}

function saleConditions(filters: SaleListFilters): SQL[] {
  const c: SQL[] = [];
  if (filters.q) {
    const like = `%${filters.q.trim()}%`;
    c.push(or(ilike(customers.name, like), ilike(saleEntries.itemName, like), ilike(saleEntries.reference, like), ilike(saleEntries.remarks, like))!);
  }
  if (filters.customerId) c.push(eq(saleEntries.customerId, filters.customerId));
  if (filters.item) c.push(ilike(saleEntries.itemName, filters.item));
  if (filters.paymentMode) c.push(eq(saleEntries.paymentMode, filters.paymentMode));
  if (filters.kind === "GOODS") c.push(sql`${saleEntries.amount} > 0`);
  if (filters.kind === "RECEIPTS") c.push(sql`${saleEntries.received} > 0`);
  if (filters.from) c.push(gte(saleEntries.entryDate, filters.from));
  if (filters.to) c.push(lte(saleEntries.entryDate, filters.to));
  return c;
}

export async function listSaleEntries(filters: SaleListFilters = {}): Promise<SaleListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const conditions = saleConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [countRow], [totalsRow]] = await Promise.all([
    db
      .select({ entry: saleEntries, customerName: customers.name })
      .from(saleEntries)
      .innerJoin(customers, eq(customers.id, saleEntries.customerId))
      .where(where)
      .orderBy(desc(saleEntries.entryDate), desc(saleEntries.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(saleEntries).innerJoin(customers, eq(customers.id, saleEntries.customerId)).where(where),
    db
      .select({
        qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`,
        debit: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
        credit: sql<string>`coalesce(sum(${saleEntries.received}), 0)`,
      })
      .from(saleEntries)
      .innerJoin(customers, eq(customers.id, saleEntries.customerId))
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r.entry, customerName: r.customerName })),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize: PAGE_SIZE,
    totals: {
      qty: toQtyString(totalsRow?.qty),
      debit: toMoneyString(totalsRow?.debit),
      credit: toMoneyString(totalsRow?.credit),
      net: toMoneyString(D(totalsRow?.debit).minus(D(totalsRow?.credit))),
    },
  };
}

export async function getSaleEntry(id: number): Promise<SaleEntry | undefined> {
  return db.query.saleEntries.findFirst({ where: eq(saleEntries.id, id) });
}

/** Distinct item names used so far (for datalists and filters). */
export async function listSaleItems(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ item: saleEntries.itemName })
    .from(saleEntries)
    .where(sql`${saleEntries.itemName} is not null`)
    .orderBy(asc(saleEntries.itemName));
  return rows.map((r) => r.item!).filter(Boolean);
}

export interface SalesOverview {
  customers: number;
  activeCustomers: number;
  withDues: number;
  withAdvance: number;
  totalOpening: string;
  totalGoods: string;
  totalReceived: string;
  /** Σ positive balances – money still to be collected from customers. */
  outstanding: string;
  /** Σ |negative balances| – customers who have paid ahead. */
  advances: string;
  entries: number;
  lastEntry: string | null;
}

/** Lifetime headline numbers of the customer khata (Summary sheet). */
export async function getSalesOverview(): Promise<SalesOverview> {
  const balances = db
    .select({
      id: customers.id,
      status: customers.status,
      opening: customers.openingBalance,
      bal: sql<string>`${customers.openingBalance} + coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0)`.as("bal"),
    })
    .from(customers)
    .leftJoin(saleEntries, eq(saleEntries.customerId, customers.id))
    .groupBy(customers.id, customers.status, customers.openingBalance)
    .as("balances");

  const [[row], [totals]] = await Promise.all([
    db
      .select({
        customers: count(),
        active: sql<number>`count(*) filter (where ${balances.status} = 'ACTIVE')`,
        withDues: sql<number>`count(*) filter (where ${balances.bal} > 0)`,
        withAdvance: sql<number>`count(*) filter (where ${balances.bal} < 0)`,
        opening: sql<string>`coalesce(sum(${balances.opening}), 0)`,
        outstanding: sql<string>`coalesce(sum(${balances.bal}) filter (where ${balances.bal} > 0), 0)`,
        advances: sql<string>`coalesce(-sum(${balances.bal}) filter (where ${balances.bal} < 0), 0)`,
      })
      .from(balances),
    db
      .select({
        goods: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
        received: sql<string>`coalesce(sum(${saleEntries.received}), 0)`,
        entries: count(),
        lastEntry: max(saleEntries.entryDate),
      })
      .from(saleEntries),
  ]);

  return {
    customers: Number(row?.customers ?? 0),
    activeCustomers: Number(row?.active ?? 0),
    withDues: Number(row?.withDues ?? 0),
    withAdvance: Number(row?.withAdvance ?? 0),
    totalOpening: toMoneyString(row?.opening),
    totalGoods: toMoneyString(totals?.goods),
    totalReceived: toMoneyString(totals?.received),
    outstanding: toMoneyString(row?.outstanding),
    advances: toMoneyString(row?.advances),
    entries: Number(totals?.entries ?? 0),
    lastEntry: totals?.lastEntry ?? null,
  };
}

export interface TopDueCustomer {
  id: number;
  name: string;
  phone: string | null;
  city: string | null;
  due: string;
  lastEntry: string | null;
  entries: number;
}

/** Customers with the highest outstanding dues (Summary sheet "Top outstanding parties"). */
export async function getTopDueCustomers(limit = 10): Promise<TopDueCustomer[]> {
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      city: customers.city,
      bal: sql<string>`${customers.openingBalance} + coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0)`,
      lastEntry: max(saleEntries.entryDate),
      entries: count(saleEntries.id),
    })
    .from(customers)
    .leftJoin(saleEntries, eq(saleEntries.customerId, customers.id))
    .groupBy(customers.id, customers.name, customers.phone, customers.city, customers.openingBalance)
    .having(sql`${customers.openingBalance} + coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0) > 0`)
    .orderBy(desc(sql`${customers.openingBalance} + coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0)`))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    city: r.city,
    due: toMoneyString(r.bal),
    lastEntry: r.lastEntry ?? null,
    entries: Number(r.entries ?? 0),
  }));
}

export interface SalesPeriodSummary {
  goods: string;
  received: string;
  net: string;
  qty: string;
  entries: number;
  goodsRows: number;
  receiptRows: number;
  customersServed: number;
}

/** Totals for a date range (dashboard tiles and the Day Report). */
export async function getSalesPeriodSummary(range: { from?: string; to?: string } = {}): Promise<SalesPeriodSummary> {
  const c: SQL[] = [];
  if (range.from) c.push(gte(saleEntries.entryDate, range.from));
  if (range.to) c.push(lte(saleEntries.entryDate, range.to));
  const [row] = await db
    .select({
      goods: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
      received: sql<string>`coalesce(sum(${saleEntries.received}), 0)`,
      qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`,
      entries: count(),
      goodsRows: sql<number>`count(*) filter (where ${saleEntries.amount} > 0)`,
      receiptRows: sql<number>`count(*) filter (where ${saleEntries.received} > 0)`,
      customersServed: sql<number>`count(distinct ${saleEntries.customerId})`,
    })
    .from(saleEntries)
    .where(c.length ? and(...c) : undefined);
  return {
    goods: toMoneyString(row?.goods),
    received: toMoneyString(row?.received),
    net: toMoneyString(D(row?.goods).minus(D(row?.received))),
    qty: toQtyString(row?.qty),
    entries: Number(row?.entries ?? 0),
    goodsRows: Number(row?.goodsRows ?? 0),
    receiptRows: Number(row?.receiptRows ?? 0),
    customersServed: Number(row?.customersServed ?? 0),
  };
}

export interface SalesMonthRow {
  month: number;
  goods: string;
  received: string;
  /** goods − received: how much the market's dues grew (or shrank) this month. */
  duesAdded: string;
  qty: string;
  entries: number;
  /** goods ÷ qty, 0 when no quantity. */
  avgRate: string;
}

export async function getSalesMonthly(year: number): Promise<SalesMonthRow[]> {
  const { from, to } = yearRange(year);
  const monthExpr = sql<number>`extract(month from ${saleEntries.entryDate})::int`;
  const rows = await db
    .select({
      month: monthExpr,
      goods: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
      received: sql<string>`coalesce(sum(${saleEntries.received}), 0)`,
      qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`,
      entries: count(),
    })
    .from(saleEntries)
    .where(and(gte(saleEntries.entryDate, from), lte(saleEntries.entryDate, to)))
    .groupBy(monthExpr);

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const r = rows.find((x) => Number(x.month) === month);
    const goods = D(r?.goods);
    const received = D(r?.received);
    const qty = D(r?.qty);
    return {
      month,
      goods: toMoneyString(goods),
      received: toMoneyString(received),
      duesAdded: toMoneyString(goods.minus(received)),
      qty: toQtyString(qty),
      entries: Number(r?.entries ?? 0),
      avgRate: toMoneyString(qty.isZero() ? ZERO : goods.dividedBy(qty)),
    };
  });
}

export interface SalesYearRow {
  year: number;
  goods: string;
  received: string;
  duesAdded: string;
  qty: string;
  entries: number;
  avgRate: string;
}

export async function getSalesYearly(): Promise<SalesYearRow[]> {
  const first = yearRange(REPORT_YEARS[0]).from;
  const last = yearRange(REPORT_YEARS[REPORT_YEARS.length - 1]).to;
  const yearExpr = sql<number>`extract(year from ${saleEntries.entryDate})::int`;
  const rows = await db
    .select({
      year: yearExpr,
      goods: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
      received: sql<string>`coalesce(sum(${saleEntries.received}), 0)`,
      qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`,
      entries: count(),
    })
    .from(saleEntries)
    .where(and(gte(saleEntries.entryDate, first), lte(saleEntries.entryDate, last)))
    .groupBy(yearExpr);

  return REPORT_YEARS.map((year) => {
    const r = rows.find((x) => Number(x.year) === year);
    const goods = D(r?.goods);
    const received = D(r?.received);
    const qty = D(r?.qty);
    return {
      year,
      goods: toMoneyString(goods),
      received: toMoneyString(received),
      duesAdded: toMoneyString(goods.minus(received)),
      qty: toQtyString(qty),
      entries: Number(r?.entries ?? 0),
      avgRate: toMoneyString(qty.isZero() ? ZERO : goods.dividedBy(qty)),
    };
  });
}

export interface SalesItemRow {
  itemName: string;
  qty: string;
  goods: string;
  entries: number;
  avgRate: string;
}

/** Item-wise goods given in a period. */
export async function getSalesByItem(range: { from?: string; to?: string } = {}): Promise<SalesItemRow[]> {
  const c: SQL[] = [sql`${saleEntries.amount} > 0`];
  if (range.from) c.push(gte(saleEntries.entryDate, range.from));
  if (range.to) c.push(lte(saleEntries.entryDate, range.to));
  const rows = await db
    .select({
      itemName: sql<string>`coalesce(${saleEntries.itemName}, 'Other')`,
      qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`,
      goods: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
      entries: count(),
    })
    .from(saleEntries)
    .where(and(...c))
    .groupBy(sql`coalesce(${saleEntries.itemName}, 'Other')`)
    .orderBy(desc(sql`sum(${saleEntries.amount})`));
  return rows.map((r) => {
    const qty = D(r.qty);
    const goods = D(r.goods);
    return {
      itemName: r.itemName,
      qty: toQtyString(qty),
      goods: toMoneyString(goods),
      entries: Number(r.entries ?? 0),
      avgRate: toMoneyString(qty.isZero() ? ZERO : goods.dividedBy(qty)),
    };
  });
}

/** Most recent entries for the dashboard. */
export async function getRecentSaleEntries(limit = 8): Promise<SaleListRow[]> {
  const result = await listSaleEntries({ page: 1 });
  return result.rows.slice(0, limit);
}
