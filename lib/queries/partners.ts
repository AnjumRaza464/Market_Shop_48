import "server-only";
import { and, asc, count, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { partners, shopExpenses, type ExpenseCategory, type Partner, type PaymentMode } from "@/db/schema";
import { D, toMoneyString, toPctString, ZERO } from "@/lib/money";

export interface PartnerWithStats extends Partner {
  expenseCount: number;
  totalPaid: string;
}

export async function listPartners(): Promise<PartnerWithStats[]> {
  const agg = db
    .select({
      partnerId: shopExpenses.paidByPartnerId,
      cnt: count().as("cnt"),
      paid: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`.as("paid"),
    })
    .from(shopExpenses)
    .groupBy(shopExpenses.paidByPartnerId)
    .as("agg");
  const rows = await db
    .select({ partner: partners, cnt: agg.cnt, paid: agg.paid })
    .from(partners)
    .leftJoin(agg, eq(agg.partnerId, partners.id))
    .orderBy(asc(partners.name));
  return rows.map((r) => ({ ...r.partner, expenseCount: Number(r.cnt ?? 0), totalPaid: toMoneyString(r.paid) }));
}

export async function getPartner(id: number): Promise<Partner | undefined> {
  return db.query.partners.findFirst({ where: eq(partners.id, id) });
}

export interface PartnerOption {
  id: number;
  name: string;
  sharePct: string;
  status: Partner["status"];
}

export async function listPartnerOptions(includeId?: number | null): Promise<PartnerOption[]> {
  const rows = await db
    .select({ id: partners.id, name: partners.name, sharePct: partners.sharePct, status: partners.status })
    .from(partners)
    .orderBy(asc(partners.name));
  return rows.filter((p) => p.status === "ACTIVE" || p.id === includeId);
}

export interface SettlementFilters {
  from?: string;
  to?: string;
  category?: ExpenseCategory;
  paymentMode?: PaymentMode;
}

export interface PartnerSettlementRow {
  id: number;
  name: string;
  sharePct: string;
  /** What this partner paid from their own pocket in the period. */
  paid: string;
  /** total × share% – what they should have borne. */
  share: string;
  /** paid − share: + they should receive from the others, − they should pay. */
  balance: string;
}

export interface PartnerSettlement {
  total: string;
  /** Expenses paid from the shop cash box (no partner). */
  shopCashBox: string;
  sharesTotal: string;
  sharesOk: boolean;
  rows: PartnerSettlementRow[];
}

/**
 * Partner settlement (Monthly Report sheet): each active partner's share of the period's total
 * expenses versus what they actually paid.
 */
export async function getPartnerSettlement(filters: SettlementFilters = {}): Promise<PartnerSettlement> {
  const c: SQL[] = [];
  if (filters.from) c.push(gte(shopExpenses.expenseDate, filters.from));
  if (filters.to) c.push(lte(shopExpenses.expenseDate, filters.to));
  if (filters.category) c.push(eq(shopExpenses.category, filters.category));
  if (filters.paymentMode) c.push(eq(shopExpenses.paymentMode, filters.paymentMode));
  const where = c.length ? and(...c) : undefined;

  const [paidRows, activePartners] = await Promise.all([
    db
      .select({
        partnerId: shopExpenses.paidByPartnerId,
        paid: sql<string>`coalesce(sum(${shopExpenses.amount}), 0)`,
      })
      .from(shopExpenses)
      .where(where)
      .groupBy(shopExpenses.paidByPartnerId),
    db.select().from(partners).where(eq(partners.status, "ACTIVE")).orderBy(asc(partners.name)),
  ]);

  const total = paidRows.reduce((acc, r) => acc.plus(D(r.paid)), ZERO);
  const shopCashBox = D(paidRows.find((r) => r.partnerId === null)?.paid);
  const sharesTotal = activePartners.reduce((acc, p) => acc.plus(D(p.sharePct)), ZERO);

  const rows = activePartners.map((p) => {
    const paid = D(paidRows.find((r) => r.partnerId === p.id)?.paid);
    const share = total.times(D(p.sharePct)).dividedBy(100);
    return {
      id: p.id,
      name: p.name,
      sharePct: toPctString(p.sharePct),
      paid: toMoneyString(paid),
      share: toMoneyString(share),
      balance: toMoneyString(paid.minus(share)),
    };
  });

  return {
    total: toMoneyString(total),
    shopCashBox: toMoneyString(shopCashBox),
    sharesTotal: toPctString(sharesTotal),
    sharesOk: activePartners.length === 0 || sharesTotal.equals(100),
    rows,
  };
}
