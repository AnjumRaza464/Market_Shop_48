import "server-only";
import { and, asc, count, eq, gte, ilike, lte, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  bills,
  parties,
  partyTransactions,
  type Party,
  type PartyStatus,
  type PaymentMode,
  type TransactionType,
} from "@/db/schema";
import { runningBalance } from "@/lib/calc";
import { yearRange } from "@/lib/dates";
import { D, toMoneyString, ZERO } from "@/lib/money";

export interface PartyWithBalance extends Party {
  balance: string;
  billCount: number;
}

export interface PartyListFilters {
  q?: string;
  status?: PartyStatus;
}

/** Signed ledger movement per party: Σcredit − Σdebit. */
function txnNetSubquery() {
  return db
    .select({
      partyId: partyTransactions.partyId,
      net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`.as("net"),
    })
    .from(partyTransactions)
    .groupBy(partyTransactions.partyId)
    .as("txn_sums");
}

export async function listParties(filters: PartyListFilters = {}): Promise<PartyWithBalance[]> {
  const sums = txnNetSubquery();
  const billCounts = db
    .select({ partyId: bills.partyId, cnt: count().as("cnt") })
    .from(bills)
    .where(ne(bills.status, "CANCELLED"))
    .groupBy(bills.partyId)
    .as("bill_counts");

  const conditions = [];
  if (filters.q) {
    const like = `%${filters.q.trim()}%`;
    conditions.push(or(ilike(parties.name, like), ilike(parties.phone, like), ilike(parties.contactPerson, like)));
  }
  if (filters.status) conditions.push(eq(parties.status, filters.status));

  const rows = await db
    .select({ party: parties, net: sums.net, billCount: billCounts.cnt })
    .from(parties)
    .leftJoin(sums, eq(sums.partyId, parties.id))
    .leftJoin(billCounts, eq(billCounts.partyId, parties.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(parties.name));

  return rows.map((r) => ({
    ...r.party,
    balance: toMoneyString(D(r.party.openingBalance).plus(D(r.net))),
    billCount: Number(r.billCount ?? 0),
  }));
}

export async function getParty(id: number): Promise<Party | undefined> {
  return db.query.parties.findFirst({ where: eq(parties.id, id) });
}

export async function getPartyBalance(id: number): Promise<string> {
  const [row] = await db
    .select({
      opening: parties.openingBalance,
      net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`,
    })
    .from(parties)
    .leftJoin(partyTransactions, eq(partyTransactions.partyId, parties.id))
    .where(eq(parties.id, id))
    .groupBy(parties.id, parties.openingBalance);
  if (!row) return "0.00";
  return toMoneyString(D(row.opening).plus(D(row.net)));
}

export interface PartyOption {
  id: number;
  name: string;
  commissionRate: string;
  defaultFreight: string;
  defaultLabour: string;
  status: PartyStatus;
  balance: string;
}

/** Active parties for dropdowns (plus a specific inactive party when editing an old record). */
export async function listPartyOptions(includeId?: number): Promise<PartyOption[]> {
  const sums = txnNetSubquery();
  const where = includeId ? or(eq(parties.status, "ACTIVE"), eq(parties.id, includeId)) : eq(parties.status, "ACTIVE");
  const rows = await db
    .select({
      id: parties.id,
      name: parties.name,
      commissionRate: parties.commissionRate,
      defaultFreight: parties.defaultFreight,
      defaultLabour: parties.defaultLabour,
      status: parties.status,
      opening: parties.openingBalance,
      net: sums.net,
    })
    .from(parties)
    .leftJoin(sums, eq(sums.partyId, parties.id))
    .where(where)
    .orderBy(asc(parties.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    commissionRate: r.commissionRate,
    defaultFreight: r.defaultFreight,
    defaultLabour: r.defaultLabour,
    status: r.status,
    balance: toMoneyString(D(r.opening).plus(D(r.net))),
  }));
}

export interface LedgerRow {
  id: number;
  txnDate: string;
  type: TransactionType;
  description: string | null;
  referenceId: number | null;
  gariNumber: string | null;
  debit: string;
  credit: string;
  paymentMode: PaymentMode | null;
  balance: string;
}

export interface PartyLedger {
  party: Party;
  from?: string;
  to?: string;
  /** Balance brought forward at the start of the range (party.openingBalance when no `from`). */
  openingBalance: string;
  rows: LedgerRow[];
  closingBalance: string;
  totals: {
    debit: string;
    credit: string;
    billsCredited: string;
    payments: string;
    advances: string;
    receipts: string;
    adjustments: string;
  };
  billStats: { count: number; gross: string; commission: string; expenses: string; net: string };
}

export async function getPartyLedger(id: number, range: { from?: string; to?: string } = {}): Promise<PartyLedger | undefined> {
  const party = await getParty(id);
  if (!party) return undefined;

  let opening = D(party.openingBalance);
  if (range.from) {
    const [before] = await db
      .select({
        net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`,
      })
      .from(partyTransactions)
      .where(and(eq(partyTransactions.partyId, id), lt(partyTransactions.txnDate, range.from)));
    opening = opening.plus(D(before?.net));
  }

  const conditions = [eq(partyTransactions.partyId, id)];
  if (range.from) conditions.push(gte(partyTransactions.txnDate, range.from));
  if (range.to) conditions.push(lte(partyTransactions.txnDate, range.to));

  const txns = await db
    .select({
      id: partyTransactions.id,
      txnDate: partyTransactions.txnDate,
      type: partyTransactions.type,
      description: partyTransactions.description,
      referenceId: partyTransactions.referenceId,
      gariNumber: bills.gariNumber,
      debit: partyTransactions.debit,
      credit: partyTransactions.credit,
      paymentMode: partyTransactions.paymentMode,
    })
    .from(partyTransactions)
    .leftJoin(bills, eq(bills.id, partyTransactions.referenceId))
    .where(and(...conditions))
    .orderBy(asc(partyTransactions.txnDate), asc(partyTransactions.id));

  const balances = runningBalance(toMoneyString(opening), txns);
  const rows: LedgerRow[] = txns.map((t, i) => ({ ...t, balance: balances[i] }));

  const totals = {
    debit: ZERO,
    credit: ZERO,
    billsCredited: ZERO,
    payments: ZERO,
    advances: ZERO,
    receipts: ZERO,
    adjustments: ZERO,
  };
  for (const t of txns) {
    totals.debit = totals.debit.plus(D(t.debit));
    totals.credit = totals.credit.plus(D(t.credit));
    if (t.type === "BILL") totals.billsCredited = totals.billsCredited.plus(D(t.credit));
    if (t.type === "PAYMENT") totals.payments = totals.payments.plus(D(t.debit));
    if (t.type === "ADVANCE") totals.advances = totals.advances.plus(D(t.debit));
    if (t.type === "RECEIPT") totals.receipts = totals.receipts.plus(D(t.credit));
    if (t.type === "ADJUSTMENT") totals.adjustments = totals.adjustments.plus(D(t.credit)).minus(D(t.debit));
  }

  const billConditions = [eq(bills.partyId, id), ne(bills.status, "CANCELLED")];
  if (range.from) billConditions.push(gte(bills.billDate, range.from));
  if (range.to) billConditions.push(lte(bills.billDate, range.to));
  const [stats] = await db
    .select({
      count: count(),
      gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
      commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
      expenses: sql<string>`coalesce(sum(${bills.totalExpenses}), 0)`,
      net: sql<string>`coalesce(sum(${bills.netAmount}), 0)`,
    })
    .from(bills)
    .where(and(...billConditions));

  const closing = rows.length ? rows[rows.length - 1].balance : toMoneyString(opening);

  return {
    party,
    from: range.from,
    to: range.to,
    openingBalance: toMoneyString(opening),
    rows,
    closingBalance: closing,
    totals: {
      debit: toMoneyString(totals.debit),
      credit: toMoneyString(totals.credit),
      billsCredited: toMoneyString(totals.billsCredited),
      payments: toMoneyString(totals.payments),
      advances: toMoneyString(totals.advances),
      receipts: toMoneyString(totals.receipts),
      adjustments: toMoneyString(totals.adjustments),
    },
    billStats: {
      count: Number(stats?.count ?? 0),
      gross: toMoneyString(stats?.gross),
      commission: toMoneyString(stats?.commission),
      expenses: toMoneyString(stats?.expenses),
      net: toMoneyString(stats?.net),
    },
  };
}

export interface PartySummaryRow {
  id: number;
  name: string;
  phone: string | null;
  status: PartyStatus;
  /** Balance brought forward at the start of the period (party opening balance when no `from`). */
  openingBalance: string;
  billCount: number;
  gross: string;
  commission: string;
  expenses: string;
  net: string;
  payments: string;
  advances: string;
  receipts: string;
  /** Closing balance at the end of the period (or today when no `to`). */
  balance: string;
}

/**
 * Position of every party for a period (Yearly Report / Party Summary sheets):
 * opening at the start of the range, movements inside it, closing at the end.
 * Without a range: lifetime figures.
 */
export async function getPartiesSummary(range: { from?: string; to?: string } = {}): Promise<PartySummaryRow[]> {
  const billConditions: SQL[] = [ne(bills.status, "CANCELLED")];
  if (range.from) billConditions.push(gte(bills.billDate, range.from));
  if (range.to) billConditions.push(lte(bills.billDate, range.to));

  const billAgg = db
    .select({
      partyId: bills.partyId,
      billCount: count().as("bill_count"),
      gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`.as("gross"),
      commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`.as("commission"),
      expenses: sql<string>`coalesce(sum(${bills.totalExpenses}), 0)`.as("expenses"),
      net: sql<string>`coalesce(sum(${bills.netAmount}), 0)`.as("net"),
    })
    .from(bills)
    .where(and(...billConditions))
    .groupBy(bills.partyId)
    .as("bill_agg");

  const txnConditions: SQL[] = [];
  if (range.from) txnConditions.push(gte(partyTransactions.txnDate, range.from));
  if (range.to) txnConditions.push(lte(partyTransactions.txnDate, range.to));

  const txnAgg = db
    .select({
      partyId: partyTransactions.partyId,
      net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`.as("txn_net"),
      payments: sql<string>`coalesce(sum(${partyTransactions.debit}) filter (where ${partyTransactions.type} = 'PAYMENT'), 0)`.as(
        "payments",
      ),
      advances: sql<string>`coalesce(sum(${partyTransactions.debit}) filter (where ${partyTransactions.type} = 'ADVANCE'), 0)`.as(
        "advances",
      ),
      receipts: sql<string>`coalesce(sum(${partyTransactions.credit}) filter (where ${partyTransactions.type} = 'RECEIPT'), 0)`.as(
        "receipts",
      ),
    })
    .from(partyTransactions)
    .where(txnConditions.length ? and(...txnConditions) : undefined)
    .groupBy(partyTransactions.partyId)
    .as("txn_agg");

  const beforeAgg = db
    .select({
      partyId: partyTransactions.partyId,
      net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`.as("before_net"),
    })
    .from(partyTransactions)
    .where(range.from ? lt(partyTransactions.txnDate, range.from) : sql`false`)
    .groupBy(partyTransactions.partyId)
    .as("before_agg");

  const rows = await db
    .select({
      id: parties.id,
      name: parties.name,
      phone: parties.phone,
      status: parties.status,
      openingBalance: parties.openingBalance,
      beforeNet: beforeAgg.net,
      billCount: billAgg.billCount,
      gross: billAgg.gross,
      commission: billAgg.commission,
      expenses: billAgg.expenses,
      net: billAgg.net,
      txnNet: txnAgg.net,
      payments: txnAgg.payments,
      advances: txnAgg.advances,
      receipts: txnAgg.receipts,
    })
    .from(parties)
    .leftJoin(billAgg, eq(billAgg.partyId, parties.id))
    .leftJoin(txnAgg, eq(txnAgg.partyId, parties.id))
    .leftJoin(beforeAgg, eq(beforeAgg.partyId, parties.id))
    .orderBy(asc(parties.name));

  return rows.map((r) => {
    const opening = D(r.openingBalance).plus(D(r.beforeNet));
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      status: r.status,
      openingBalance: toMoneyString(opening),
      billCount: Number(r.billCount ?? 0),
      gross: toMoneyString(r.gross),
      commission: toMoneyString(r.commission),
      expenses: toMoneyString(r.expenses),
      net: toMoneyString(r.net),
      payments: toMoneyString(r.payments),
      advances: toMoneyString(r.advances),
      receipts: toMoneyString(r.receipts),
      balance: toMoneyString(opening.plus(D(r.txnNet))),
    };
  });
}

export interface PartyMonthRow {
  month: number;
  opening: string;
  billCount: number;
  gross: string;
  commission: string;
  expenses: string;
  net: string;
  paid: string;
  closing: string;
}

/** Month-wise khata of one party for a calendar year (Party Statement sheet). */
export async function getPartyMonthlyBreakdown(id: number, year: number): Promise<PartyMonthRow[]> {
  const { from, to } = yearRange(year);
  const billMonth = sql<number>`extract(month from ${bills.billDate})::int`;
  const txnMonth = sql<number>`extract(month from ${partyTransactions.txnDate})::int`;

  const [party, [before], billRows, txnRows] = await Promise.all([
    getParty(id),
    db
      .select({ net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)` })
      .from(partyTransactions)
      .where(and(eq(partyTransactions.partyId, id), lt(partyTransactions.txnDate, from))),
    db
      .select({
        month: billMonth,
        count: count(),
        gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
        commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
        expenses: sql<string>`coalesce(sum(${bills.totalExpenses}), 0)`,
        net: sql<string>`coalesce(sum(${bills.netAmount}), 0)`,
      })
      .from(bills)
      .where(and(eq(bills.partyId, id), ne(bills.status, "CANCELLED"), gte(bills.billDate, from), lte(bills.billDate, to)))
      .groupBy(billMonth),
    db
      .select({
        month: txnMonth,
        net: sql<string>`coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`,
        paid: sql<string>`coalesce(sum(${partyTransactions.debit}) filter (where ${partyTransactions.type} in ('PAYMENT','ADVANCE')), 0)`,
      })
      .from(partyTransactions)
      .where(and(eq(partyTransactions.partyId, id), gte(partyTransactions.txnDate, from), lte(partyTransactions.txnDate, to)))
      .groupBy(txnMonth),
  ]);

  let running = D(party?.openingBalance).plus(D(before?.net));
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const b = billRows.find((r) => Number(r.month) === month);
    const t = txnRows.find((r) => Number(r.month) === month);
    const opening = running;
    running = running.plus(D(t?.net));
    return {
      month,
      opening: toMoneyString(opening),
      billCount: Number(b?.count ?? 0),
      gross: toMoneyString(b?.gross),
      commission: toMoneyString(b?.commission),
      expenses: toMoneyString(b?.expenses),
      net: toMoneyString(b?.net),
      paid: toMoneyString(t?.paid),
      closing: toMoneyString(running),
    };
  });
}
