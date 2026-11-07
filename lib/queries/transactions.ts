import "server-only";
import { and, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { parties, partyTransactions, type PartyTransaction, type TransactionType } from "@/db/schema";
import { PAGE_SIZE } from "@/lib/constants";
import { toMoneyString } from "@/lib/money";

export interface TransactionListFilters {
  partyId?: number;
  type?: TransactionType;
  from?: string;
  to?: string;
  page?: number;
}

export interface TransactionRow extends PartyTransaction {
  partyName: string;
}

export interface TransactionListResult {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { debit: string; credit: string };
}

export async function listTransactions(filters: TransactionListFilters = {}): Promise<TransactionListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const conditions: SQL[] = [];
  if (filters.partyId) conditions.push(eq(partyTransactions.partyId, filters.partyId));
  if (filters.type) conditions.push(eq(partyTransactions.type, filters.type));
  if (filters.from) conditions.push(gte(partyTransactions.txnDate, filters.from));
  if (filters.to) conditions.push(lte(partyTransactions.txnDate, filters.to));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [countRow], [totalsRow]] = await Promise.all([
    db
      .select({ txn: partyTransactions, partyName: parties.name })
      .from(partyTransactions)
      .innerJoin(parties, eq(parties.id, partyTransactions.partyId))
      .where(where)
      .orderBy(desc(partyTransactions.txnDate), desc(partyTransactions.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(partyTransactions).where(where),
    db
      .select({
        debit: sql<string>`coalesce(sum(${partyTransactions.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${partyTransactions.credit}), 0)`,
      })
      .from(partyTransactions)
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r.txn, partyName: r.partyName })),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize: PAGE_SIZE,
    totals: { debit: toMoneyString(totalsRow?.debit), credit: toMoneyString(totalsRow?.credit) },
  };
}

export async function getTransaction(id: number): Promise<PartyTransaction | undefined> {
  return db.query.partyTransactions.findFirst({ where: eq(partyTransactions.id, id) });
}
