import "server-only";
import ExcelJS from "exceljs";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { billItems, bills, cashEntries, partners, partyTransactions, saleEntries, shopExpenses, customers, parties } from "@/db/schema";
import {
  BILL_STATUSES,
  CASH_ENTRY_TYPES,
  CASH_SOURCES,
  EXPENSE_CATEGORIES,
  SHOP,
  TRANSACTION_TYPES,
  labelFor,
  paymentModeLabel,
} from "@/lib/constants";
import { formatDate, todayISO } from "@/lib/dates";
import { D, formatMoney, ZERO } from "@/lib/money";
import { getCashPosition, listCashBook } from "@/lib/queries/cash";
import { listCustomers } from "@/lib/queries/customers";
import { listPartners } from "@/lib/queries/partners";
import { listParties } from "@/lib/queries/parties";
import { billNumber } from "@/lib/utils";

/**
 * Full backup of the shop's books as one formatted Excel workbook – one sheet per module,
 * real numbers and dates (not text) so Excel can filter, sort and total them, plus a Summary sheet.
 */

type ColType = "text" | "money" | "qty" | "pct" | "int" | "date";
interface Column {
  header: string;
  key: string;
  width?: number;
  type?: ColType;
  /** Add a SUM() to the totals row for this column. */
  total?: boolean;
}

const COLORS = {
  headerFill: "FF1F5F3F", // deep green (matches the app sidebar)
  headerText: "FFFFFFFF",
  band: "FFF3F7F4",
  totalFill: "FFE4EEE8",
  title: "FF1F5F3F",
  muted: "FF6B7280",
  border: "FFD1D5DB",
};
const NUM_FMT: Record<Exclude<ColType, "text">, string> = {
  money: '#,##0.00;[Red]-#,##0.00;"-"',
  qty: "#,##0.###",
  pct: '0.00"%"',
  int: "#,##0",
  date: "dd-mmm-yyyy",
};

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  return Number(D(value).toFixed(3));
}

function cellValue(type: ColType | undefined, raw: unknown): ExcelJS.CellValue {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case "date":
      return toDate(String(raw));
    case "money":
    case "qty":
    case "pct":
    case "int":
      return num(raw as string | number);
    default:
      return typeof raw === "string" ? raw : String(raw);
  }
}

const thin: Partial<ExcelJS.Borders> = {
  bottom: { style: "thin", color: { argb: COLORS.border } },
};

function addTable(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, unknown>[], description?: string): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: description ? 3 : 1 }] });
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width ?? 16 }));

  let headerRowNo = 1;
  if (description) {
    const title = ws.addRow([name]);
    title.font = { bold: true, size: 14, color: { argb: COLORS.title } };
    ws.mergeCells(1, 1, 1, columns.length);
    const desc = ws.addRow([description]);
    desc.font = { italic: true, size: 10, color: { argb: COLORS.muted } };
    ws.mergeCells(2, 1, 2, columns.length);
    headerRowNo = 3;
  }

  const header = ws.addRow(columns.map((c) => c.header));
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerFill } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = thin;
  });

  rows.forEach((r, i) => {
    const row = ws.addRow(columns.map((c) => cellValue(c.type, r[c.key])));
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = columns[colNumber - 1];
      if (col.type && col.type !== "text") cell.numFmt = NUM_FMT[col.type];
      if (col.type === "money" || col.type === "qty" || col.type === "pct" || col.type === "int") cell.alignment = { horizontal: "right" };
      if (col.type === "date") cell.alignment = { horizontal: "center" };
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.band } };
      cell.border = thin;
    });
  });

  const firstDataRow = headerRowNo + 1;
  const lastDataRow = headerRowNo + rows.length;
  if (columns.some((c) => c.total)) {
    const totals = ws.addRow([]);
    totals.getCell(1).value = `Total (${rows.length} rows)`;
    columns.forEach((c, idx) => {
      const cell = totals.getCell(idx + 1);
      if (c.total && rows.length > 0) {
        const letter = ws.getColumn(idx + 1).letter;
        cell.value = { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})` };
        cell.numFmt = NUM_FMT[c.type === "text" || !c.type ? "money" : c.type];
        cell.alignment = { horizontal: "right" };
      }
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalFill } };
      cell.border = { top: { style: "medium", color: { argb: COLORS.headerFill } } };
    });
  }

  if (rows.length > 0) {
    ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: lastDataRow, column: columns.length } };
  }
  return ws;
}

function partyPosition(balance: string): string {
  const d = D(balance);
  if (d.isZero()) return "Settled";
  return d.greaterThan(0) ? "Payable to party" : "Receivable from party";
}

function customerPositionLabel(balance: string): string {
  const d = D(balance);
  if (d.isZero()) return "Clear";
  return d.greaterThan(0) ? "Due from customer" : "Advance from customer";
}

export interface BackupCounts {
  parties: number;
  bills: number;
  billItems: number;
  transactions: number;
  customers: number;
  saleEntries: number;
  expenses: number;
  partners: number;
  cashEntries: number;
}

export async function getBackupCounts(): Promise<BackupCounts> {
  const [r] = await db
    .select({
      parties: sql<number>`(select count(*) from ${parties})::int`,
      bills: sql<number>`(select count(*) from ${bills})::int`,
      billItems: sql<number>`(select count(*) from ${billItems})::int`,
      transactions: sql<number>`(select count(*) from ${partyTransactions})::int`,
      customers: sql<number>`(select count(*) from ${customers})::int`,
      saleEntries: sql<number>`(select count(*) from ${saleEntries})::int`,
      expenses: sql<number>`(select count(*) from ${shopExpenses})::int`,
      partners: sql<number>`(select count(*) from ${partners})::int`,
      cashEntries: sql<number>`(select count(*) from ${cashEntries})::int`,
    })
    .from(sql`(select 1) as one`);
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v ?? 0)])) as unknown as BackupCounts;
}

/** The sheets in the backup, in order, with a one-line description (shown on the Export page and the Summary sheet). */
export const BACKUP_SHEETS: { name: string; description: string }[] = [
  { name: "Summary", description: "Shop totals on the day of export and what every sheet contains" },
  { name: "Suppliers", description: "Supplier parties with opening and current balance" },
  { name: "Bills (Pattis)", description: "One row per patti: gross, commission, expenses, net and final payable" },
  { name: "Bill Items", description: "Every line of every patti: item, size, quantity, rate, amount" },
  { name: "Supplier Ledger", description: "All supplier transactions (bills, payments, advances, receipts) with a running balance per party" },
  { name: "Customers", description: "Customer parties with goods given, received and balance" },
  { name: "Customer Khata", description: "Every khata row: goods given, cash received, running balance per customer" },
  { name: "Shop Expenses", description: "Every shop expense with category, paid by and mode" },
  { name: "Partners", description: "Partners, share % and what each paid" },
  { name: "Cash Book", description: "Every cash movement in date order with the running cash balance" },
  { name: "Cash Entries", description: "Manual cash entries: opening, deposits, withdrawals, transfers, adjustments" },
];

export async function buildBackupWorkbook(): Promise<{ buffer: Uint8Array; filename: string }> {
  const today = todayISO();
  const [partyRows, customerRows, cash, cashBook, counts] = await Promise.all([
    listParties(),
    listCustomers(),
    getCashPosition(),
    listCashBook({ pageSize: 1_000_000 }),
    getBackupCounts(),
  ]);
  const [billRows, itemRows, txnRows, saleRows, expenseRows, partnerRows, cashEntryRows] = await Promise.all([
    db
      .select({ bill: bills, partyName: parties.name })
      .from(bills)
      .innerJoin(parties, eq(parties.id, bills.partyId))
      .orderBy(asc(bills.billDate), asc(bills.id)),
    db
      .select({ item: billItems, billDate: bills.billDate, partyName: parties.name })
      .from(billItems)
      .innerJoin(bills, eq(bills.id, billItems.billId))
      .innerJoin(parties, eq(parties.id, bills.partyId))
      .orderBy(asc(bills.billDate), asc(billItems.billId), asc(billItems.lineNo)),
    db
      .select({ txn: partyTransactions, partyName: parties.name, partyOpening: parties.openingBalance, gariNumber: bills.gariNumber })
      .from(partyTransactions)
      .innerJoin(parties, eq(parties.id, partyTransactions.partyId))
      .leftJoin(bills, eq(bills.id, partyTransactions.referenceId))
      .orderBy(asc(parties.name), asc(partyTransactions.txnDate), asc(partyTransactions.id)),
    db
      .select({ entry: saleEntries, customerName: customers.name, customerOpening: customers.openingBalance })
      .from(saleEntries)
      .innerJoin(customers, eq(customers.id, saleEntries.customerId))
      .orderBy(asc(customers.name), asc(saleEntries.entryDate), asc(saleEntries.id)),
    db
      .select({ expense: shopExpenses, partnerName: partners.name })
      .from(shopExpenses)
      .leftJoin(partners, eq(partners.id, shopExpenses.paidByPartnerId))
      .orderBy(asc(shopExpenses.expenseDate), asc(shopExpenses.id)),
    listPartners(),
    db
      .select({ entry: cashEntries, partnerName: partners.name })
      .from(cashEntries)
      .leftJoin(partners, eq(partners.id, cashEntries.partnerId))
      .orderBy(asc(cashEntries.entryDate), asc(cashEntries.id)),
  ]);

  const itemsByBill = new Map<number, string[]>();
  for (const r of itemRows) itemsByBill.set(r.item.billId, [...(itemsByBill.get(r.item.billId) ?? []), r.item.itemName]);

  const wb = new ExcelJS.Workbook();
  wb.creator = SHOP.name;
  wb.created = new Date();

  // ---------- Summary ----------
  const summary = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 34 }, { width: 22 }, { width: 70 }];
  const t = summary.addRow([`${SHOP.name} – full backup`]);
  t.font = { bold: true, size: 16, color: { argb: COLORS.title } };
  summary.addRow([`Exported on ${formatDate(today)}${SHOP.address ? ` · ${SHOP.address}` : ""}${SHOP.phone ? ` · ${SHOP.phone}` : ""}`]).font = { italic: true, color: { argb: COLORS.muted } };
  summary.addRow([]);

  const payable = partyRows.reduce((acc, p) => (D(p.balance).greaterThan(0) ? acc.plus(D(p.balance)) : acc), ZERO);
  const receivable = partyRows.reduce((acc, p) => (D(p.balance).lessThan(0) ? acc.plus(D(p.balance).abs()) : acc), ZERO);
  const dues = customerRows.reduce((acc, c) => (D(c.balance).greaterThan(0) ? acc.plus(D(c.balance)) : acc), ZERO);
  const advances = customerRows.reduce((acc, c) => (D(c.balance).lessThan(0) ? acc.plus(D(c.balance).abs()) : acc), ZERO);
  const pendingBills = billRows.filter((b) => b.bill.status === "PENDING");
  const pendingPayable = pendingBills.reduce((acc, b) => acc.plus(D(b.bill.finalPayable)), ZERO);

  const section = (label: string) => {
    const r = summary.addRow([label]);
    r.font = { bold: true, color: { argb: COLORS.headerText } };
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerFill } };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerFill } };
    r.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerFill } };
  };
  const kv = (label: string, value: number | string, note?: string, type: "money" | "int" | "text" = "money") => {
    const r = summary.addRow([label, value, note ?? ""]);
    const cell = r.getCell(2);
    if (type !== "text") {
      cell.numFmt = NUM_FMT[type];
      cell.alignment = { horizontal: "right" };
    }
    cell.font = { bold: true };
    r.getCell(3).font = { color: { argb: COLORS.muted } };
  };

  section("Cash position (today)");
  kv("Cash in hand", Number(cash.cashInHand), "Physical cash – Cash mode only");
  kv("Bank & digital", Number(cash.bankAndDigital), "Bank, JazzCash, Easypaisa, cheque, other");
  kv("Total funds", Number(cash.total));
  summary.addRow([]);
  section("Supplier khata");
  kv("Payable to suppliers", Number(payable.toFixed(2)), `${partyRows.filter((p) => D(p.balance).greaterThan(0)).length} parties we owe`);
  kv("Advances with suppliers", Number(receivable.toFixed(2)), `${partyRows.filter((p) => D(p.balance).lessThan(0)).length} parties owe us`);
  kv("Pending pattis", pendingBills.length, `${formatMoney(pendingPayable)} still to be paid out`, "int");
  summary.addRow([]);
  section("Customer khata");
  kv("Market outstanding (dues)", Number(dues.toFixed(2)), `${customerRows.filter((c) => D(c.balance).greaterThan(0)).length} customers owe us`);
  kv("Customer advances", Number(advances.toFixed(2)), `${customerRows.filter((c) => D(c.balance).lessThan(0)).length} customers paid ahead`);
  summary.addRow([]);
  section("Rows in this backup");
  kv("Suppliers", counts.parties, "", "int");
  kv("Bills (pattis)", counts.bills, `${counts.billItems} item lines`, "int");
  kv("Supplier transactions", counts.transactions, "", "int");
  kv("Customers", counts.customers, "", "int");
  kv("Customer khata entries", counts.saleEntries, "", "int");
  kv("Shop expenses", counts.expenses, "", "int");
  kv("Partners", counts.partners, "", "int");
  kv("Manual cash entries", counts.cashEntries, "", "int");
  summary.addRow([]);
  section("Sheets in this file");
  for (const s of BACKUP_SHEETS) kv(s.name, "", s.description, "text");

  // ---------- Suppliers ----------
  addTable(
    wb,
    "Suppliers",
    [
      { header: "ID", key: "id", width: 7, type: "int" },
      { header: "Party name", key: "name", width: 28 },
      { header: "Contact person", key: "contactPerson", width: 20 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Market / city", key: "address", width: 20 },
      { header: "Main items", key: "mainItems", width: 22 },
      { header: "Commission %", key: "commissionRate", width: 13, type: "pct" },
      { header: "Opening balance", key: "openingBalance", width: 16, type: "money", total: true },
      { header: "Bills", key: "billCount", width: 8, type: "int", total: true },
      { header: "Current balance", key: "balance", width: 16, type: "money", total: true },
      { header: "Position", key: "position", width: 22 },
      { header: "Status", key: "status", width: 10 },
      { header: "Notes", key: "notes", width: 30 },
    ],
    partyRows.map((p) => ({ ...p, status: p.status === "ACTIVE" ? "Active" : "Inactive", position: partyPosition(p.balance) })),
    "Balance = opening + Σ credit (bills, receipts) − Σ debit (payments, advances). Positive = we owe the party.",
  );

  // ---------- Bills ----------
  addTable(
    wb,
    "Bills (Pattis)",
    [
      { header: "Bill no", key: "no", width: 10 },
      { header: "Date", key: "billDate", width: 13, type: "date" },
      { header: "Party", key: "partyName", width: 26 },
      { header: "Gari no", key: "gariNumber", width: 12 },
      { header: "Items", key: "items", width: 28 },
      { header: "Gross amount", key: "grossAmount", width: 15, type: "money", total: true },
      { header: "Comm %", key: "commissionPct", width: 9, type: "pct" },
      { header: "Commission", key: "commissionAmount", width: 14, type: "money", total: true },
      { header: "Freight (kiraya)", key: "freight", width: 14, type: "money", total: true },
      { header: "Labour (mazdoori)", key: "labour", width: 15, type: "money", total: true },
      { header: "Market fee", key: "marketFee", width: 12, type: "money", total: true },
      { header: "Munshiyana", key: "munshiyana", width: 12, type: "money", total: true },
      { header: "Other expense", key: "otherExpense", width: 13, type: "money", total: true },
      { header: "Other note", key: "otherExpenseNote", width: 16 },
      { header: "Total expenses", key: "totalExpenses", width: 14, type: "money", total: true },
      { header: "Net amount", key: "netAmount", width: 15, type: "money", total: true },
      { header: "Advance adjusted", key: "advanceAdjusted", width: 15, type: "money", total: true },
      { header: "Final payable", key: "finalPayable", width: 15, type: "money", total: true },
      { header: "Status", key: "status", width: 11 },
      { header: "Notes", key: "notes", width: 30 },
    ],
    billRows.map((r) => ({
      ...r.bill,
      no: billNumber(r.bill.id),
      partyName: r.partyName,
      items: (itemsByBill.get(r.bill.id) ?? []).join(", "),
      status: labelFor(BILL_STATUSES, r.bill.status),
    })),
    "Net = gross − commission − total expenses; final payable = net − advance adjusted.",
  );

  // ---------- Bill items ----------
  addTable(
    wb,
    "Bill Items",
    [
      { header: "Bill no", key: "no", width: 10 },
      { header: "Date", key: "billDate", width: 13, type: "date" },
      { header: "Party", key: "partyName", width: 26 },
      { header: "Line", key: "lineNo", width: 6, type: "int" },
      { header: "Item", key: "itemName", width: 20 },
      { header: "Size", key: "size", width: 10 },
      { header: "Quantity", key: "quantity", width: 12, type: "qty", total: true },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Rate", key: "rate", width: 12, type: "money" },
      { header: "Amount", key: "amount", width: 15, type: "money", total: true },
    ],
    itemRows.map((r) => ({ ...r.item, no: billNumber(r.item.billId), billDate: r.billDate, partyName: r.partyName })),
  );

  // ---------- Supplier ledger ----------
  const ledgerRows: Record<string, unknown>[] = [];
  let currentParty: string | null = null;
  let running = ZERO;
  for (const r of txnRows) {
    if (r.partyName !== currentParty) {
      currentParty = r.partyName;
      running = D(r.partyOpening);
      ledgerRows.push({ partyName: r.partyName, type: "Opening balance", balance: running.toFixed(2) });
    }
    running = running.plus(D(r.txn.credit)).minus(D(r.txn.debit));
    ledgerRows.push({
      partyName: r.partyName,
      txnDate: r.txn.txnDate,
      type: labelFor(TRANSACTION_TYPES, r.txn.type),
      description: r.txn.description,
      billNo: r.txn.referenceId ? billNumber(r.txn.referenceId) : null,
      gariNumber: r.gariNumber,
      paymentMode: r.txn.paymentMode ? paymentModeLabel(r.txn.paymentMode) : null,
      debit: r.txn.debit,
      credit: r.txn.credit,
      balance: running.toFixed(2),
    });
  }
  addTable(
    wb,
    "Supplier Ledger",
    [
      { header: "Party", key: "partyName", width: 26 },
      { header: "Date", key: "txnDate", width: 13, type: "date" },
      { header: "Type", key: "type", width: 20 },
      { header: "Description", key: "description", width: 40 },
      { header: "Bill no", key: "billNo", width: 10 },
      { header: "Gari no", key: "gariNumber", width: 10 },
      { header: "Mode", key: "paymentMode", width: 12 },
      { header: "Debit (paid to party)", key: "debit", width: 18, type: "money", total: true },
      { header: "Credit (we owe party)", key: "credit", width: 18, type: "money", total: true },
      { header: "Balance", key: "balance", width: 16, type: "money" },
    ],
    ledgerRows,
    "Sorted by party then date. Balance runs from each party's opening balance; positive = payable to the party.",
  );

  // ---------- Customers ----------
  addTable(
    wb,
    "Customers",
    [
      { header: "ID", key: "id", width: 7, type: "int" },
      { header: "Customer name", key: "name", width: 28 },
      { header: "Contact person", key: "contactPerson", width: 20 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "City / mandi", key: "city", width: 18 },
      { header: "Address", key: "address", width: 24 },
      { header: "Opening balance", key: "openingBalance", width: 16, type: "money", total: true },
      { header: "Goods given (Dr)", key: "totalDebit", width: 16, type: "money", total: true },
      { header: "Received (Cr)", key: "totalCredit", width: 16, type: "money", total: true },
      { header: "Balance", key: "balance", width: 16, type: "money", total: true },
      { header: "Position", key: "position", width: 22 },
      { header: "Entries", key: "entryCount", width: 9, type: "int", total: true },
      { header: "Last entry", key: "lastEntry", width: 13, type: "date" },
      { header: "Status", key: "status", width: 10 },
      { header: "Notes", key: "notes", width: 30 },
    ],
    customerRows.map((c) => ({ ...c, status: c.status === "ACTIVE" ? "Active" : "Inactive", position: customerPositionLabel(c.balance) })),
    "Balance = opening + Σ goods given − Σ received. Positive = due from the customer, negative = customer paid in advance.",
  );

  // ---------- Customer khata ----------
  const khataRows: Record<string, unknown>[] = [];
  let currentCustomer: string | null = null;
  running = ZERO;
  for (const r of saleRows) {
    if (r.customerName !== currentCustomer) {
      currentCustomer = r.customerName;
      running = D(r.customerOpening);
      khataRows.push({ customerName: r.customerName, itemName: "Opening balance", balance: running.toFixed(2) });
    }
    running = running.plus(D(r.entry.amount)).minus(D(r.entry.received));
    khataRows.push({
      customerName: r.customerName,
      entryDate: r.entry.entryDate,
      itemName: r.entry.itemName,
      quantity: r.entry.quantity,
      unit: r.entry.unit,
      rate: r.entry.rate,
      amount: D(r.entry.amount).isZero() ? null : r.entry.amount,
      received: D(r.entry.received).isZero() ? null : r.entry.received,
      paymentMode: r.entry.paymentMode ? paymentModeLabel(r.entry.paymentMode) : null,
      reference: r.entry.reference,
      remarks: r.entry.remarks,
      balance: running.toFixed(2),
    });
  }
  addTable(
    wb,
    "Customer Khata",
    [
      { header: "Customer", key: "customerName", width: 26 },
      { header: "Date", key: "entryDate", width: 13, type: "date" },
      { header: "Item", key: "itemName", width: 20 },
      { header: "Quantity", key: "quantity", width: 11, type: "qty", total: true },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Rate", key: "rate", width: 12, type: "money" },
      { header: "Goods amount (Dr)", key: "amount", width: 17, type: "money", total: true },
      { header: "Received (Cr)", key: "received", width: 15, type: "money", total: true },
      { header: "Mode", key: "paymentMode", width: 12 },
      { header: "Bill / ref", key: "reference", width: 12 },
      { header: "Remarks", key: "remarks", width: 30 },
      { header: "Balance", key: "balance", width: 16, type: "money" },
    ],
    khataRows,
    "Sorted by customer then date. Balance runs from each customer's opening balance; positive = due from the customer.",
  );

  // ---------- Shop expenses ----------
  addTable(
    wb,
    "Shop Expenses",
    [
      { header: "Date", key: "expenseDate", width: 13, type: "date" },
      { header: "Category", key: "category", width: 24 },
      { header: "Amount", key: "amount", width: 14, type: "money", total: true },
      { header: "Paid by", key: "paidBy", width: 18 },
      { header: "Mode", key: "paymentMode", width: 12 },
      { header: "Notes", key: "notes", width: 40 },
    ],
    expenseRows.map((r) => ({
      ...r.expense,
      category: labelFor(EXPENSE_CATEGORIES, r.expense.category),
      paidBy: r.partnerName ?? "Shop cash box",
      paymentMode: paymentModeLabel(r.expense.paymentMode),
    })),
    "Expenses marked “Shop cash box” reduce cash in hand; those paid by a partner come from the partner's own pocket.",
  );

  // ---------- Partners ----------
  addTable(
    wb,
    "Partners",
    [
      { header: "ID", key: "id", width: 7, type: "int" },
      { header: "Partner", key: "name", width: 26 },
      { header: "Share %", key: "sharePct", width: 10, type: "pct", total: true },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Status", key: "status", width: 10 },
      { header: "Expenses paid", key: "expenseCount", width: 14, type: "int", total: true },
      { header: "Total paid", key: "totalPaid", width: 15, type: "money", total: true },
      { header: "Notes", key: "notes", width: 30 },
    ],
    partnerRows.map((p) => ({ ...p, status: p.status === "ACTIVE" ? "Active" : "Inactive" })),
  );

  // ---------- Cash book ----------
  addTable(
    wb,
    "Cash Book",
    [
      { header: "Date", key: "date", width: 13, type: "date" },
      { header: "Movement", key: "movement", width: 24 },
      { header: "Party / detail", key: "who", width: 26 },
      { header: "Note", key: "note", width: 30 },
      { header: "Bill no", key: "billNo", width: 10 },
      { header: "Account", key: "mode", width: 14 },
      { header: "Cash in", key: "cashIn", width: 15, type: "money", total: true },
      { header: "Cash out", key: "cashOut", width: 15, type: "money", total: true },
      { header: "Balance (all accounts)", key: "balance", width: 20, type: "money" },
    ],
    cashBook.rows.map((r) => ({
      date: r.date,
      movement: labelFor(CASH_SOURCES, r.source),
      who: r.source === "EXPENSE" ? labelFor(EXPENSE_CATEGORIES, r.who as (typeof EXPENSE_CATEGORIES)[number]["value"]) : (r.who ?? "Shop"),
      note: r.note,
      billNo: r.billId ? billNumber(r.billId) : null,
      mode: paymentModeLabel(r.mode),
      cashIn: D(r.cashIn).isZero() ? null : r.cashIn,
      cashOut: D(r.cashOut).isZero() ? null : r.cashOut,
      balance: r.balance,
    })),
    `Every movement across all accounts in date order. Cash in hand (Cash only) today: ${formatMoney(cash.cashInHand)}; bank & digital: ${formatMoney(cash.bankAndDigital)}.`,
  );

  // ---------- Cash entries ----------
  addTable(
    wb,
    "Cash Entries",
    [
      { header: "ID", key: "id", width: 7, type: "int" },
      { header: "Date", key: "entryDate", width: 13, type: "date" },
      { header: "Type", key: "type", width: 26 },
      { header: "Side", key: "direction", width: 8 },
      { header: "Amount", key: "amount", width: 15, type: "money", total: true },
      { header: "Account", key: "paymentMode", width: 14 },
      { header: "To account", key: "toMode", width: 14 },
      { header: "Partner", key: "partnerName", width: 20 },
      { header: "Notes", key: "notes", width: 40 },
    ],
    cashEntryRows.map((r) => ({
      ...r.entry,
      type: labelFor(CASH_ENTRY_TYPES, r.entry.type),
      direction: r.entry.direction === "IN" ? "In" : "Out",
      paymentMode: paymentModeLabel(r.entry.paymentMode),
      toMode: r.entry.toMode ? paymentModeLabel(r.entry.toMode) : null,
      partnerName: r.partnerName,
    })),
  );

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = SHOP.name.replace(/[^\w\-]+/g, "_");
  return { buffer: new Uint8Array(buffer as ArrayBuffer), filename: `${safeName}_backup_${today}.xlsx` };
}
