import "server-only";
import { and, asc, count, eq, gte, ilike, lt, lte, max, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, saleEntries, type Customer, type PartyStatus, type PaymentMode } from "@/db/schema";
import type { CustomerPosition } from "@/lib/constants";
import { runningDueBalance } from "@/lib/calc";
import { D, toMoneyString, toQtyString, ZERO } from "@/lib/money";

/** Sign of a customer balance → khata position. */
export function customerPosition(balance: string): CustomerPosition {
  const d = D(balance);
  if (d.isZero()) return "CLEAR";
  return d.greaterThan(0) ? "DUE" : "ADVANCE";
}

/** Per-customer aggregates of the sale entries. */
function entryAggSubquery() {
  return db
    .select({
      customerId: saleEntries.customerId,
      debit: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`.as("debit"),
      credit: sql<string>`coalesce(sum(${saleEntries.received}), 0)`.as("credit"),
      qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`.as("qty"),
      entries: count().as("entries"),
      lastEntry: max(saleEntries.entryDate).as("last_entry"),
    })
    .from(saleEntries)
    .groupBy(saleEntries.customerId)
    .as("entry_agg");
}

export interface CustomerWithBalance extends Customer {
  totalDebit: string;
  totalCredit: string;
  balance: string;
  position: CustomerPosition;
  entryCount: number;
  lastEntry: string | null;
}

export interface CustomerListFilters {
  q?: string;
  status?: PartyStatus;
  position?: CustomerPosition;
}

export async function listCustomers(filters: CustomerListFilters = {}): Promise<CustomerWithBalance[]> {
  const agg = entryAggSubquery();
  const conditions: SQL[] = [];
  if (filters.q) {
    const like = `%${filters.q.trim()}%`;
    conditions.push(
      or(ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.city, like), ilike(customers.contactPerson, like))!,
    );
  }
  if (filters.status) conditions.push(eq(customers.status, filters.status));

  const rows = await db
    .select({
      customer: customers,
      debit: agg.debit,
      credit: agg.credit,
      entries: agg.entries,
      lastEntry: agg.lastEntry,
    })
    .from(customers)
    .leftJoin(agg, eq(agg.customerId, customers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(customers.name));

  const mapped = rows.map((r) => {
    const balance = toMoneyString(D(r.customer.openingBalance).plus(D(r.debit)).minus(D(r.credit)));
    return {
      ...r.customer,
      totalDebit: toMoneyString(r.debit),
      totalCredit: toMoneyString(r.credit),
      balance,
      position: customerPosition(balance),
      entryCount: Number(r.entries ?? 0),
      lastEntry: r.lastEntry ?? null,
    };
  });
  return filters.position ? mapped.filter((c) => c.position === filters.position) : mapped;
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  return db.query.customers.findFirst({ where: eq(customers.id, id) });
}

export interface CustomerOption {
  id: number;
  name: string;
  city: string | null;
  status: PartyStatus;
  balance: string;
}

/** Active customers for dropdowns (plus a specific inactive one when editing an old record). */
export async function listCustomerOptions(includeId?: number): Promise<CustomerOption[]> {
  const agg = entryAggSubquery();
  const where = includeId ? or(eq(customers.status, "ACTIVE"), eq(customers.id, includeId)) : eq(customers.status, "ACTIVE");
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      city: customers.city,
      status: customers.status,
      opening: customers.openingBalance,
      debit: agg.debit,
      credit: agg.credit,
    })
    .from(customers)
    .leftJoin(agg, eq(agg.customerId, customers.id))
    .where(where)
    .orderBy(asc(customers.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    status: r.status,
    balance: toMoneyString(D(r.opening).plus(D(r.debit)).minus(D(r.credit))),
  }));
}

export interface CustomerLedgerRow {
  id: number;
  entryDate: string;
  itemName: string | null;
  quantity: string | null;
  unit: string | null;
  rate: string | null;
  debit: string;
  credit: string;
  paymentMode: PaymentMode | null;
  reference: string | null;
  remarks: string | null;
  balance: string;
}

export interface CustomerLedger {
  customer: Customer;
  from?: string;
  to?: string;
  /** Balance brought forward at the start of the range (opening balance when no `from`). */
  openingBalance: string;
  rows: CustomerLedgerRow[];
  closingBalance: string;
  totals: { debit: string; credit: string; qty: string; goodsRows: number; receiptRows: number };
  /** Lifetime figures regardless of the selected range. */
  lifetime: { debit: string; credit: string; balance: string; entries: number; lastEntry: string | null };
}

export async function getCustomerLedger(id: number, range: { from?: string; to?: string } = {}): Promise<CustomerLedger | undefined> {
  const customer = await getCustomer(id);
  if (!customer) return undefined;

  let opening = D(customer.openingBalance);
  if (range.from) {
    const [before] = await db
      .select({
        net: sql<string>`coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0)`,
      })
      .from(saleEntries)
      .where(and(eq(saleEntries.customerId, id), lt(saleEntries.entryDate, range.from)));
    opening = opening.plus(D(before?.net));
  }

  const conditions = [eq(saleEntries.customerId, id)];
  if (range.from) conditions.push(gte(saleEntries.entryDate, range.from));
  if (range.to) conditions.push(lte(saleEntries.entryDate, range.to));

  const [entries, [life]] = await Promise.all([
    db
      .select()
      .from(saleEntries)
      .where(and(...conditions))
      .orderBy(asc(saleEntries.entryDate), asc(saleEntries.id)),
    db
      .select({
        debit: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`,
        credit: sql<string>`coalesce(sum(${saleEntries.received}), 0)`,
        entries: count(),
        lastEntry: max(saleEntries.entryDate),
      })
      .from(saleEntries)
      .where(eq(saleEntries.customerId, id)),
  ]);

  const balances = runningDueBalance(
    toMoneyString(opening),
    entries.map((e) => ({ debit: e.amount, credit: e.received })),
  );
  const rows: CustomerLedgerRow[] = entries.map((e, i) => ({
    id: e.id,
    entryDate: e.entryDate,
    itemName: e.itemName,
    quantity: e.quantity,
    unit: e.unit,
    rate: e.rate,
    debit: e.amount,
    credit: e.received,
    paymentMode: e.paymentMode,
    reference: e.reference,
    remarks: e.remarks,
    balance: balances[i],
  }));

  let debit = ZERO;
  let credit = ZERO;
  let qty = ZERO;
  let goodsRows = 0;
  let receiptRows = 0;
  for (const e of entries) {
    debit = debit.plus(D(e.amount));
    credit = credit.plus(D(e.received));
    qty = qty.plus(D(e.quantity));
    if (D(e.amount).greaterThan(0)) goodsRows++;
    if (D(e.received).greaterThan(0)) receiptRows++;
  }

  return {
    customer,
    from: range.from,
    to: range.to,
    openingBalance: toMoneyString(opening),
    rows,
    closingBalance: rows.length ? rows[rows.length - 1].balance : toMoneyString(opening),
    totals: { debit: toMoneyString(debit), credit: toMoneyString(credit), qty: toQtyString(qty), goodsRows, receiptRows },
    lifetime: {
      debit: toMoneyString(life?.debit),
      credit: toMoneyString(life?.credit),
      balance: toMoneyString(D(customer.openingBalance).plus(D(life?.debit)).minus(D(life?.credit))),
      entries: Number(life?.entries ?? 0),
      lastEntry: life?.lastEntry ?? null,
    },
  };
}

export interface CustomerSummaryRow {
  id: number;
  name: string;
  phone: string | null;
  city: string | null;
  status: PartyStatus;
  /** Balance at the start of the period (opening balance when no `from`). */
  opening: string;
  debit: string;
  credit: string;
  qty: string;
  entries: number;
  closing: string;
  position: CustomerPosition;
  lastEntry: string | null;
}

/**
 * Customer-wise position for a period: opening (brought forward), goods given, cash received,
 * closing. Without a range it is the lifetime summary (opening = opening balance).
 */
export async function getCustomersSummary(range: { from?: string; to?: string } = {}): Promise<CustomerSummaryRow[]> {
  const periodConditions: SQL[] = [];
  if (range.from) periodConditions.push(gte(saleEntries.entryDate, range.from));
  if (range.to) periodConditions.push(lte(saleEntries.entryDate, range.to));

  const period = db
    .select({
      customerId: saleEntries.customerId,
      debit: sql<string>`coalesce(sum(${saleEntries.amount}), 0)`.as("p_debit"),
      credit: sql<string>`coalesce(sum(${saleEntries.received}), 0)`.as("p_credit"),
      qty: sql<string>`coalesce(sum(${saleEntries.quantity}), 0)`.as("p_qty"),
      entries: count().as("p_entries"),
      lastEntry: max(saleEntries.entryDate).as("p_last"),
    })
    .from(saleEntries)
    .where(periodConditions.length ? and(...periodConditions) : undefined)
    .groupBy(saleEntries.customerId)
    .as("period");

  const before = db
    .select({
      customerId: saleEntries.customerId,
      net: sql<string>`coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0)`.as("b_net"),
    })
    .from(saleEntries)
    .where(range.from ? lt(saleEntries.entryDate, range.from) : sql`false`)
    .groupBy(saleEntries.customerId)
    .as("before");

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      city: customers.city,
      status: customers.status,
      openingBalance: customers.openingBalance,
      beforeNet: before.net,
      debit: period.debit,
      credit: period.credit,
      qty: period.qty,
      entries: period.entries,
      lastEntry: period.lastEntry,
    })
    .from(customers)
    .leftJoin(period, eq(period.customerId, customers.id))
    .leftJoin(before, eq(before.customerId, customers.id))
    .orderBy(asc(customers.name));

  return rows.map((r) => {
    const opening = D(r.openingBalance).plus(D(r.beforeNet));
    const closing = opening.plus(D(r.debit)).minus(D(r.credit));
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      status: r.status,
      opening: toMoneyString(opening),
      debit: toMoneyString(r.debit),
      credit: toMoneyString(r.credit),
      qty: toQtyString(r.qty),
      entries: Number(r.entries ?? 0),
      closing: toMoneyString(closing),
      position: customerPosition(toMoneyString(closing)),
      lastEntry: r.lastEntry ?? null,
    };
  });
}
