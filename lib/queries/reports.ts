import "server-only";
import { and, count, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bills, parties, partyTransactions, shopExpenses } from "@/db/schema";
import { REPORT_YEARS, yearRange } from "@/lib/dates";
import { D, toMoneyString } from "@/lib/money";

export interface DateRange {
  from?: string;
  to?: string;
}

function billRangeConditions(range: DateRange): SQL[] {
  const c: SQL[] = [ne(bills.status, "CANCELLED")];
  if (range.from) c.push(gte(bills.billDate, range.from));
  if (range.to) c.push(lte(bills.billDate, range.to));
  return c;
}

function expenseRangeConditions(range: DateRange): SQL[] {
  const c: SQL[] = [];
  if (range.from) c.push(gte(shopExpenses.expenseDate, range.from));
  if (range.to) c.push(lte(shopExpenses.expenseDate, range.to));
  return c;
}

export interface PeriodSummary {
  grossSales: string;
  commission: string;
  billExpenses: string;
  netToParties: string;
  shopExpenses: string;
  profit: string;
  billCount: number;
  pendingCount: number;
  pendingAmount: string;
  expenseCount: number;
}

/** Headline numbers for a date range: sales, commission earned, shop expenses, profit. */
export async function getPeriodSummary(range: DateRange = {}): Promise<PeriodSummary> {
  const [[billRow], [expenseRow], [pendingRow]] = await Promise.all([
    db
      .select({
        count: count(),
        gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
        commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
        expenses: sql<string>`coalesce(sum(${bills.totalExpenses}), 0)`,
        net: sql<string>`coalesce(sum(${bills.netAmount}), 0)`,
      })
      .from(bills)
      .where(and(...billRangeConditions(range))),
    db
      .select({
        count: count(),
        total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
      })
      .from(shopExpenses)
      .where(expenseRangeConditions(range).length ? and(...expenseRangeConditions(range)) : undefined),
    db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${bills.finalPayable}), 0)`,
      })
      .from(bills)
      .where(and(...billRangeConditions(range), eq(bills.status, "PENDING"))),
  ]);

  const commission = D(billRow?.commission);
  const shopTotal = D(expenseRow?.total);

  return {
    grossSales: toMoneyString(billRow?.gross),
    commission: toMoneyString(commission),
    billExpenses: toMoneyString(billRow?.expenses),
    netToParties: toMoneyString(billRow?.net),
    shopExpenses: toMoneyString(shopTotal),
    profit: toMoneyString(commission.minus(shopTotal)),
    billCount: Number(billRow?.count ?? 0),
    pendingCount: Number(pendingRow?.count ?? 0),
    pendingAmount: toMoneyString(pendingRow?.amount),
    expenseCount: Number(expenseRow?.count ?? 0),
  };
}

export interface PartyPositions {
  payable: string;
  payableCount: number;
  receivable: string;
  receivableCount: number;
  activeParties: number;
}

/** Who we owe vs. who owes us, across all parties (lifetime balances). */
export async function getPartyPositions(): Promise<PartyPositions> {
  const balances = db
    .select({
      id: parties.id,
      bal: sql<string>`${parties.openingBalance} + coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`.as(
        "bal",
      ),
    })
    .from(parties)
    .leftJoin(partyTransactions, eq(partyTransactions.partyId, parties.id))
    .groupBy(parties.id, parties.openingBalance)
    .as("balances");

  const [[row], [active]] = await Promise.all([
    db
      .select({
        payable: sql<string>`coalesce(sum(${balances.bal}) filter (where ${balances.bal} > 0), 0)`,
        payableCount: sql<number>`count(*) filter (where ${balances.bal} > 0)`,
        receivable: sql<string>`coalesce(-sum(${balances.bal}) filter (where ${balances.bal} < 0), 0)`,
        receivableCount: sql<number>`count(*) filter (where ${balances.bal} < 0)`,
      })
      .from(balances),
    db.select({ count: count() }).from(parties).where(eq(parties.status, "ACTIVE")),
  ]);

  return {
    payable: toMoneyString(row?.payable),
    payableCount: Number(row?.payableCount ?? 0),
    receivable: toMoneyString(row?.receivable),
    receivableCount: Number(row?.receivableCount ?? 0),
    activeParties: Number(active?.count ?? 0),
  };
}

export interface MonthlyProfitRow {
  month: number;
  billCount: number;
  gross: string;
  commission: string;
  billExpenses: string;
  /** Breakdown of the pass-through bill expenses (Profit Report sheet columns). */
  freight: string;
  labour: string;
  otherBillExpenses: string;
  shopExpenses: string;
  profit: string;
}

export async function getMonthlyProfit(year: number): Promise<MonthlyProfitRow[]> {
  const { from, to } = yearRange(year);
  const billMonth = sql<number>`extract(month from ${bills.billDate})::int`;
  const expenseMonth = sql<number>`extract(month from ${shopExpenses.expenseDate})::int`;

  const [billRows, expenseRows] = await Promise.all([
    db
      .select({
        month: billMonth,
        count: count(),
        gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
        commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
        expenses: sql<string>`coalesce(sum(${bills.totalExpenses}), 0)`,
        freight: sql<string>`coalesce(sum(${bills.freight}), 0)`,
        labour: sql<string>`coalesce(sum(${bills.labour}), 0)`,
        other: sql<string>`coalesce(sum(${bills.marketFee} + ${bills.munshiyana} + ${bills.otherExpense}), 0)`,
      })
      .from(bills)
      .where(and(ne(bills.status, "CANCELLED"), gte(bills.billDate, from), lte(bills.billDate, to)))
      .groupBy(billMonth),
    db
      .select({
        month: expenseMonth,
        total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
      })
      .from(shopExpenses)
      .where(and(gte(shopExpenses.expenseDate, from), lte(shopExpenses.expenseDate, to)))
      .groupBy(expenseMonth),
  ]);

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const b = billRows.find((r) => Number(r.month) === month);
    const e = expenseRows.find((r) => Number(r.month) === month);
    const commission = D(b?.commission);
    const shop = D(e?.total);
    return {
      month,
      billCount: Number(b?.count ?? 0),
      gross: toMoneyString(b?.gross),
      commission: toMoneyString(commission),
      billExpenses: toMoneyString(b?.expenses),
      freight: toMoneyString(b?.freight),
      labour: toMoneyString(b?.labour),
      otherBillExpenses: toMoneyString(b?.other),
      shopExpenses: toMoneyString(shop),
      profit: toMoneyString(commission.minus(shop)),
    };
  });
}

export interface YearlyProfitRow {
  year: number;
  billCount: number;
  gross: string;
  commission: string;
  shopExpenses: string;
  profit: string;
}

export async function getYearlyProfit(): Promise<YearlyProfitRow[]> {
  const first = yearRange(REPORT_YEARS[0]).from;
  const last = yearRange(REPORT_YEARS[REPORT_YEARS.length - 1]).to;
  const billYear = sql<number>`extract(year from ${bills.billDate})::int`;
  const expenseYear = sql<number>`extract(year from ${shopExpenses.expenseDate})::int`;

  const [billRows, expenseRows] = await Promise.all([
    db
      .select({
        year: billYear,
        count: count(),
        gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
        commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
      })
      .from(bills)
      .where(and(ne(bills.status, "CANCELLED"), gte(bills.billDate, first), lte(bills.billDate, last)))
      .groupBy(billYear),
    db
      .select({ year: expenseYear, total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)` })
      .from(shopExpenses)
      .where(and(gte(shopExpenses.expenseDate, first), lte(shopExpenses.expenseDate, last)))
      .groupBy(expenseYear),
  ]);

  return REPORT_YEARS.map((year) => {
    const b = billRows.find((r) => Number(r.year) === year);
    const e = expenseRows.find((r) => Number(r.year) === year);
    const commission = D(b?.commission);
    const shop = D(e?.total);
    return {
      year,
      billCount: Number(b?.count ?? 0),
      gross: toMoneyString(b?.gross),
      commission: toMoneyString(commission),
      shopExpenses: toMoneyString(shop),
      profit: toMoneyString(commission.minus(shop)),
    };
  });
}

export interface TopPartyRow {
  id: number;
  name: string;
  billCount: number;
  gross: string;
  commission: string;
}

export async function getTopParties(range: DateRange = {}, limit = 5): Promise<TopPartyRow[]> {
  const rows = await db
    .select({
      id: parties.id,
      name: parties.name,
      billCount: count(),
      gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
      commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
    })
    .from(bills)
    .innerJoin(parties, eq(parties.id, bills.partyId))
    .where(and(...billRangeConditions(range)))
    .groupBy(parties.id, parties.name)
    .orderBy(desc(sql`sum(${bills.grossAmount})`))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    billCount: Number(r.billCount),
    gross: toMoneyString(r.gross),
    commission: toMoneyString(r.commission),
  }));
}
