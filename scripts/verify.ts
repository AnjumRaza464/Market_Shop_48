/**
 * Data-integrity audit for Market 48 Shop. Read-only.
 *
 *   npm run db:verify
 *
 * Supplier side (bills / pattis):
 *   • every bill item amount = qty × rate
 *   • gross = Σ items, commission = gross × pct %, total expenses = Σ expense columns,
 *     net = gross − commission − expenses, final payable = net − advance adjusted
 *   • every non-cancelled bill has exactly one BILL ledger entry equal to its net
 *   • every PAID bill with a positive final payable has a PAYMENT entry equal to it; PENDING bills have none
 *   • cancelled bills have no ledger entries
 *   • party balance = opening + Σcredit − Σdebit (recomputed row by row)
 * Customer side (khata entries):
 *   • amount = qty × rate when both present, 0 otherwise; no empty rows
 *   • customer balance = opening + Σamount − Σreceived
 * Shop:
 *   • active partners' shares sum to 100 (warning only)
 *
 * Exits with code 1 when any hard check fails.
 */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { billItems, bills, customers, parties, partners, partyTransactions, saleEntries } from "@/db/schema";
import { calculateBill, calculateSaleEntry } from "@/lib/calc";
import { D, toMoneyString } from "@/lib/money";

const problems: string[] = [];
const warnings: string[] = [];
const fail = (msg: string) => problems.push(msg);

async function verifyBills() {
  const allBills = await db.select().from(bills).orderBy(asc(bills.id));
  const items = await db.select().from(billItems).orderBy(asc(billItems.billId), asc(billItems.lineNo));
  const txns = await db.select().from(partyTransactions);
  const byBill = new Map<number, typeof items>();
  for (const it of items) byBill.set(it.billId, [...(byBill.get(it.billId) ?? []), it]);

  let paidChecked = 0;
  for (const b of allBills) {
    const lines = byBill.get(b.id) ?? [];
    if (lines.length === 0) fail(`Bill ${b.id}: no item lines`);
    const calc = calculateBill({
      items: lines.map((l) => ({ itemName: l.itemName, size: l.size, quantity: l.quantity, unit: l.unit, rate: l.rate })),
      commissionPct: b.commissionPct,
      freight: b.freight,
      labour: b.labour,
      marketFee: b.marketFee,
      munshiyana: b.munshiyana,
      otherExpense: b.otherExpense,
      advanceAdjusted: b.advanceAdjusted,
    });
    lines.forEach((l, i) => {
      if (calc.items[i].amount !== toMoneyString(l.amount)) fail(`Bill ${b.id} line ${l.lineNo}: amount ${l.amount} ≠ qty×rate ${calc.items[i].amount}`);
    });
    const checks: [string, string, string][] = [
      ["gross", b.grossAmount, calc.grossAmount],
      ["commission", b.commissionAmount, calc.commissionAmount],
      ["total expenses", b.totalExpenses, calc.totalExpenses],
      ["net", b.netAmount, calc.netAmount],
      ["final payable", b.finalPayable, calc.finalPayable],
    ];
    for (const [label, stored, expected] of checks) {
      if (toMoneyString(stored) !== expected) fail(`Bill ${b.id}: stored ${label} ${stored} ≠ recomputed ${expected}`);
    }

    const ledger = txns.filter((t) => t.referenceId === b.id);
    const billEntries = ledger.filter((t) => t.type === "BILL");
    const payEntries = ledger.filter((t) => t.type === "PAYMENT");
    if (b.status === "CANCELLED") {
      if (ledger.length) fail(`Bill ${b.id}: cancelled but has ${ledger.length} ledger entries`);
      continue;
    }
    if (billEntries.length !== 1) fail(`Bill ${b.id}: expected 1 BILL ledger entry, found ${billEntries.length}`);
    else {
      const e = billEntries[0];
      const net = D(b.netAmount);
      const expected = net.isNegative() ? { debit: net.abs().toFixed(2), credit: "0.00" } : { debit: "0.00", credit: net.toFixed(2) };
      if (toMoneyString(e.credit) !== expected.credit || toMoneyString(e.debit) !== expected.debit)
        fail(`Bill ${b.id}: BILL entry dr ${e.debit} / cr ${e.credit} ≠ expected dr ${expected.debit} / cr ${expected.credit}`);
      if (e.partyId !== b.partyId) fail(`Bill ${b.id}: BILL entry posted to party ${e.partyId}, bill belongs to ${b.partyId}`);
      if (e.txnDate !== b.billDate) fail(`Bill ${b.id}: BILL entry dated ${e.txnDate}, bill dated ${b.billDate}`);
    }
    if (b.status === "PAID") {
      paidChecked++;
      if (D(b.finalPayable).greaterThan(0)) {
        if (payEntries.length !== 1) fail(`Bill ${b.id}: PAID but ${payEntries.length} PAYMENT entries`);
        else if (toMoneyString(payEntries[0].debit) !== toMoneyString(b.finalPayable))
          fail(`Bill ${b.id}: PAYMENT ${payEntries[0].debit} ≠ final payable ${b.finalPayable}`);
      } else if (payEntries.length) fail(`Bill ${b.id}: nothing payable but has a PAYMENT entry`);
    } else if (payEntries.length) fail(`Bill ${b.id}: PENDING but has ${payEntries.length} PAYMENT entries`);
  }
  console.log(`Bills: ${allBills.length} checked (${paidChecked} paid) – item math, deductions, net, final payable and ledger postings.`);
}

async function verifyPartyBalances() {
  const rows = await db.select().from(parties).orderBy(asc(parties.id));
  const txns = await db.select().from(partyTransactions).orderBy(asc(partyTransactions.partyId), asc(partyTransactions.txnDate), asc(partyTransactions.id));
  const [agg] = await db
    .select({
      payable: sql<string>`coalesce(sum(bal) filter (where bal > 0), 0)`,
      receivable: sql<string>`coalesce(-sum(bal) filter (where bal < 0), 0)`,
    })
    .from(
      db
        .select({
          bal: sql<string>`${parties.openingBalance} + coalesce(sum(${partyTransactions.credit}) - sum(${partyTransactions.debit}), 0)`.as("bal"),
        })
        .from(parties)
        .leftJoin(partyTransactions, eq(partyTransactions.partyId, parties.id))
        .groupBy(parties.id, parties.openingBalance)
        .as("b"),
    );
  let payable = D(0);
  let receivable = D(0);
  for (const p of rows) {
    let bal = D(p.openingBalance);
    for (const t of txns.filter((t) => t.partyId === p.id)) bal = bal.plus(D(t.credit)).minus(D(t.debit));
    if (bal.greaterThan(0)) payable = payable.plus(bal);
    if (bal.isNegative()) receivable = receivable.plus(bal.abs());
  }
  if (toMoneyString(payable) !== toMoneyString(agg.payable)) fail(`Supplier payable: row-by-row ${payable} ≠ SQL aggregate ${agg.payable}`);
  if (toMoneyString(receivable) !== toMoneyString(agg.receivable)) fail(`Supplier receivable: row-by-row ${receivable} ≠ SQL aggregate ${agg.receivable}`);
  console.log(`Suppliers: ${rows.length} parties – payable ${toMoneyString(payable)}, advances outstanding ${toMoneyString(receivable)} (SQL aggregates match).`);
}

async function verifyCustomers() {
  const rows = await db.select().from(customers).orderBy(asc(customers.id));
  const entries = await db.select().from(saleEntries).orderBy(asc(saleEntries.customerId), asc(saleEntries.entryDate), asc(saleEntries.id));
  for (const e of entries) {
    const calc = calculateSaleEntry({ quantity: e.quantity, rate: e.rate, received: e.received });
    if (calc.amount !== toMoneyString(e.amount)) fail(`Khata entry ${e.id}: amount ${e.amount} ≠ qty×rate ${calc.amount}`);
    if (D(e.amount).isZero() && D(e.received).isZero()) fail(`Khata entry ${e.id}: empty row`);
    if (D(e.amount).greaterThan(0) && !e.itemName) fail(`Khata entry ${e.id}: goods amount without item name`);
  }
  const [agg] = await db
    .select({
      due: sql<string>`coalesce(sum(bal) filter (where bal > 0), 0)`,
      advance: sql<string>`coalesce(-sum(bal) filter (where bal < 0), 0)`,
    })
    .from(
      db
        .select({
          bal: sql<string>`${customers.openingBalance} + coalesce(sum(${saleEntries.amount}) - sum(${saleEntries.received}), 0)`.as("bal"),
        })
        .from(customers)
        .leftJoin(saleEntries, eq(saleEntries.customerId, customers.id))
        .groupBy(customers.id, customers.openingBalance)
        .as("b"),
    );
  let due = D(0);
  let advance = D(0);
  for (const c of rows) {
    let bal = D(c.openingBalance);
    for (const e of entries.filter((e) => e.customerId === c.id)) bal = bal.plus(D(e.amount)).minus(D(e.received));
    if (bal.greaterThan(0)) due = due.plus(bal);
    if (bal.isNegative()) advance = advance.plus(bal.abs());
  }
  if (toMoneyString(due) !== toMoneyString(agg.due)) fail(`Customer dues: row-by-row ${due} ≠ SQL aggregate ${agg.due}`);
  if (toMoneyString(advance) !== toMoneyString(agg.advance)) fail(`Customer advances: row-by-row ${advance} ≠ SQL aggregate ${agg.advance}`);
  console.log(`Customers: ${rows.length} customers, ${entries.length} khata entries – dues ${toMoneyString(due)}, advances ${toMoneyString(advance)} (SQL aggregates match).`);
}

async function verifyPartners() {
  const rows = await db.select().from(partners).where(eq(partners.status, "ACTIVE"));
  const total = rows.reduce((a, p) => a.plus(D(p.sharePct)), D(0));
  if (rows.length && !total.equals(100)) warnings.push(`Active partners' shares sum to ${total}% (expected 100%).`);
  console.log(`Partners: ${rows.length} active, shares total ${total}%.`);
}

async function main() {
  await verifyBills();
  await verifyPartyBalances();
  await verifyCustomers();
  await verifyPartners();
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems.slice(0, 50)) console.error(`  ✗ ${p}`);
    if (problems.length > 50) console.error(`  … and ${problems.length - 50} more`);
    process.exit(1);
  }
  console.log("\nAll integrity checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Verify failed:", error);
  process.exit(1);
});
