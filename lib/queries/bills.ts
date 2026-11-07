import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  billItems,
  bills,
  parties,
  partyTransactions,
  type Bill,
  type BillItem,
  type BillStatus,
  type Party,
  type PartyTransaction,
} from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { toMoneyString } from "@/lib/money";

export interface BillListFilters {
  q?: string;
  from?: string;
  to?: string;
  status?: BillStatus;
  partyId?: number;
  page?: number;
}

export interface BillListRow {
  id: number;
  billDate: string;
  gariNumber: string | null;
  partyId: number;
  partyName: string;
  itemsSummary: string | null;
  grossAmount: string;
  commissionAmount: string;
  totalExpenses: string;
  netAmount: string;
  finalPayable: string;
  status: BillStatus;
}

export interface BillListResult {
  rows: BillListRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { gross: string; commission: string; expenses: string; net: string };
}

function billConditions(filters: BillListFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.q) {
    const q = filters.q.trim();
    const like = `%${q}%`;
    const idMatch = /^(?:P-?)?0*(\d+)$/i.exec(q);
    const parts = [ilike(parties.name, like), ilike(bills.gariNumber, like)];
    if (idMatch) parts.push(eq(bills.id, Number(idMatch[1])));
    conditions.push(or(...parts)!);
  }
  if (filters.from) conditions.push(gte(bills.billDate, filters.from));
  if (filters.to) conditions.push(lte(bills.billDate, filters.to));
  if (filters.status) conditions.push(eq(bills.status, filters.status));
  if (filters.partyId) conditions.push(eq(bills.partyId, filters.partyId));
  return conditions;
}

export async function listBills(filters: BillListFilters = {}): Promise<BillListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const conditions = billConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;

  const itemSummary = db
    .select({
      billId: billItems.billId,
      summary: sql<string>`string_agg(${billItems.itemName}, ', ' order by ${billItems.lineNo})`.as("summary"),
    })
    .from(billItems)
    .groupBy(billItems.billId)
    .as("item_summary");

  const [rows, [countRow], [totalsRow]] = await Promise.all([
    db
      .select({
        id: bills.id,
        billDate: bills.billDate,
        gariNumber: bills.gariNumber,
        partyId: bills.partyId,
        partyName: parties.name,
        itemsSummary: itemSummary.summary,
        grossAmount: bills.grossAmount,
        commissionAmount: bills.commissionAmount,
        totalExpenses: bills.totalExpenses,
        netAmount: bills.netAmount,
        finalPayable: bills.finalPayable,
        status: bills.status,
      })
      .from(bills)
      .innerJoin(parties, eq(parties.id, bills.partyId))
      .leftJoin(itemSummary, eq(itemSummary.billId, bills.id))
      .where(where)
      .orderBy(desc(bills.billDate), desc(bills.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(bills).innerJoin(parties, eq(parties.id, bills.partyId)).where(where),
    db
      .select({
        gross: sql<string>`coalesce(sum(${bills.grossAmount}), 0)`,
        commission: sql<string>`coalesce(sum(${bills.commissionAmount}), 0)`,
        expenses: sql<string>`coalesce(sum(${bills.totalExpenses}), 0)`,
        net: sql<string>`coalesce(sum(${bills.netAmount}), 0)`,
      })
      .from(bills)
      .innerJoin(parties, eq(parties.id, bills.partyId))
      .where(
        filters.status === "CANCELLED"
          ? where
          : and(...(conditions.length ? conditions : []), ne(bills.status, "CANCELLED")),
      ),
  ]);

  return {
    rows,
    total: Number(countRow?.total ?? 0),
    page,
    pageSize: PAGE_SIZE,
    totals: {
      gross: toMoneyString(totalsRow?.gross),
      commission: toMoneyString(totalsRow?.commission),
      expenses: toMoneyString(totalsRow?.expenses),
      net: toMoneyString(totalsRow?.net),
    },
  };
}

export type BillDetail = Bill & { party: Party; items: BillItem[]; transactions: PartyTransaction[] };

export async function getBill(id: number): Promise<BillDetail | undefined> {
  return db.query.bills.findFirst({
    where: eq(bills.id, id),
    with: {
      party: true,
      items: { orderBy: [asc(billItems.lineNo)] },
      transactions: { orderBy: [asc(partyTransactions.id)] },
    },
  });
}

export async function getRecentBills(limit = 8): Promise<BillListRow[]> {
  const result = await listBills({ page: 1 });
  return result.rows.slice(0, limit);
}
