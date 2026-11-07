import "server-only";
import { and, count, desc, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { partners, shopExpenses, type ExpenseCategory, type PaymentMode, type ShopExpense } from "@/db/schema";
import { EXPENSE_CATEGORIES, PAGE_SIZE } from "@/lib/constants";
import { REPORT_YEARS, yearRange } from "@/lib/dates";
import { D, toMoneyString, ZERO } from "@/lib/money";

export interface ExpenseListFilters {
  from?: string;
  to?: string;
  category?: ExpenseCategory;
  paymentMode?: PaymentMode;
  /** Partner id, or "SHOP" for expenses paid from the shop cash box. */
  paidBy?: number | "SHOP";
  page?: number;
}

export interface ExpenseRow extends ShopExpense {
  partnerName: string | null;
}

export interface ExpenseListResult {
  rows: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
  sumAmount: string;
  byCategory: { category: ExpenseCategory; total: string; entries: number }[];
  /** Average spend per calendar day inside the range (0 when the range is open-ended). */
  dailyAverage: string;
}

function expenseConditions(filters: ExpenseListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(shopExpenses.expenseDate, filters.from));
  if (filters.to) conditions.push(lte(shopExpenses.expenseDate, filters.to));
  if (filters.category) conditions.push(eq(shopExpenses.category, filters.category));
  if (filters.paymentMode) conditions.push(eq(shopExpenses.paymentMode, filters.paymentMode));
  if (filters.paidBy === "SHOP") conditions.push(isNull(shopExpenses.paidByPartnerId));
  else if (typeof filters.paidBy === "number") conditions.push(eq(shopExpenses.paidByPartnerId, filters.paidBy));
  return conditions;
}

function daysBetween(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

export async function listExpenses(filters: ExpenseListFilters = {}): Promise<ExpenseListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const conditions = expenseConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [countRow], byCategory] = await Promise.all([
    db
      .select({ expense: shopExpenses, partnerName: partners.name })
      .from(shopExpenses)
      .leftJoin(partners, eq(partners.id, shopExpenses.paidByPartnerId))
      .where(where)
      .orderBy(desc(shopExpenses.expenseDate), desc(shopExpenses.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(shopExpenses).where(where),
    db
      .select({
        category: shopExpenses.category,
        total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
        entries: count(),
      })
      .from(shopExpenses)
      .where(where)
      .groupBy(shopExpenses.category),
  ]);

  const sumAmount = byCategory.reduce((acc, r) => acc.plus(D(r.total)), ZERO);
  const ordered = EXPENSE_CATEGORIES.map((c) => {
    const r = byCategory.find((x) => x.category === c.value);
    return { category: c.value, total: toMoneyString(r?.total), entries: Number(r?.entries ?? 0) };
  }).filter((r) => !D(r.total).isZero());
  const days = daysBetween(filters.from, filters.to);

  return {
    rows: rows.map((r) => ({ ...r.expense, partnerName: r.partnerName })),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize: PAGE_SIZE,
    sumAmount: toMoneyString(sumAmount),
    byCategory: ordered,
    dailyAverage: toMoneyString(days ? sumAmount.dividedBy(days) : ZERO),
  };
}

/** Total of the expenses matching the filters (used for the "vs previous period" comparison). */
export async function getExpenseTotal(filters: Omit<ExpenseListFilters, "page">): Promise<{ total: string; entries: number }> {
  const conditions = expenseConditions(filters);
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`, entries: count() })
    .from(shopExpenses)
    .where(conditions.length ? and(...conditions) : undefined);
  return { total: toMoneyString(row?.total), entries: Number(row?.entries ?? 0) };
}

/** The range of equal length immediately before [from, to]. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = daysBetween(from, to);
  const shift = (iso: string, by: number) => {
    const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + by));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  return { from: shift(from, -days), to: shift(from, -1) };
}

export async function getExpense(id: number): Promise<ShopExpense | undefined> {
  return db.query.shopExpenses.findFirst({ where: eq(shopExpenses.id, id) });
}

export interface ExpenseMatrixCell {
  month: number;
  category: ExpenseCategory;
  total: string;
}

/** Month × category totals for one year. */
export async function getExpenseMonthlyMatrix(year: number): Promise<ExpenseMatrixCell[]> {
  const { from, to } = yearRange(year);
  const monthExpr = sql<number>`extract(month from ${shopExpenses.expenseDate})::int`;
  const rows = await db
    .select({
      month: monthExpr,
      category: shopExpenses.category,
      total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
    })
    .from(shopExpenses)
    .where(and(gte(shopExpenses.expenseDate, from), lte(shopExpenses.expenseDate, to)))
    .groupBy(monthExpr, shopExpenses.category);
  return rows.map((r) => ({ month: Number(r.month), category: r.category, total: toMoneyString(r.total) }));
}

export interface ExpenseYearRow {
  year: number;
  total: string;
  byCategory: Record<ExpenseCategory, string>;
  entries: number;
}

/** Year-wise totals for the supported report range (2026–2035). */
export async function getExpenseYearlyTotals(): Promise<ExpenseYearRow[]> {
  const yearExpr = sql<number>`extract(year from ${shopExpenses.expenseDate})::int`;
  const rows = await db
    .select({
      year: yearExpr,
      category: shopExpenses.category,
      total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
      entries: count(),
    })
    .from(shopExpenses)
    .where(
      and(
        gte(shopExpenses.expenseDate, yearRange(REPORT_YEARS[0]).from),
        lte(shopExpenses.expenseDate, yearRange(REPORT_YEARS[REPORT_YEARS.length - 1]).to),
      ),
    )
    .groupBy(yearExpr, shopExpenses.category);

  return REPORT_YEARS.map((year) => {
    const yearRows = rows.filter((r) => Number(r.year) === year);
    const byCategory = Object.fromEntries(
      EXPENSE_CATEGORIES.map((c) => [
        c.value,
        toMoneyString(yearRows.find((r) => r.category === c.value)?.total),
      ]),
    ) as Record<ExpenseCategory, string>;
    return {
      year,
      total: toMoneyString(yearRows.reduce((acc, r) => acc.plus(D(r.total)), ZERO)),
      byCategory,
      entries: yearRows.reduce((acc, r) => acc + Number(r.entries), 0),
    };
  });
}

/** Month totals for one year (for the partner × month table and the trend chart). */
export async function getExpenseMonthlyByPartner(year: number): Promise<{ month: number; partnerId: number | null; total: string }[]> {
  const { from, to } = yearRange(year);
  const monthExpr = sql<number>`extract(month from ${shopExpenses.expenseDate})::int`;
  const rows = await db
    .select({
      month: monthExpr,
      partnerId: shopExpenses.paidByPartnerId,
      total: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
    })
    .from(shopExpenses)
    .where(and(gte(shopExpenses.expenseDate, from), lte(shopExpenses.expenseDate, to)))
    .groupBy(monthExpr, shopExpenses.paidByPartnerId);
  return rows.map((r) => ({ month: Number(r.month), partnerId: r.partnerId, total: toMoneyString(r.total) }));
}
