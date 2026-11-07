/**
 * Patti (bill) calculation. Pure and side-effect free so it runs identically on the
 * client (live totals while typing) and on the server (authoritative values that are stored).
 *
 *   line amount     = quantity × rate                        (rounded half-up to 2 dp)
 *   gross amount    = Σ line amounts
 *   commission      = gross × commission% / 100              (rounded half-up to 2 dp)
 *   total expenses  = freight + labour + market fee + munshiyana + other
 *   net amount      = gross − commission − total expenses    → credited to the party ledger
 *   final payable   = net amount − advance adjusted          → cash handed over now
 */
import { D, round2, sum, toMoneyString, toPctString, toQtyString } from "./money";

export interface BillLineInput {
  itemName: string;
  /** Size / count (dana) – optional. */
  size?: string | null;
  quantity: string;
  unit: string;
  rate: string;
}

export interface BillCalcInput {
  items: BillLineInput[];
  commissionPct: string;
  freight: string;
  labour: string;
  marketFee: string;
  munshiyana: string;
  otherExpense: string;
  advanceAdjusted: string;
}

export interface BillLineResult {
  itemName: string;
  size: string | null;
  quantity: string;
  unit: string;
  rate: string;
  amount: string;
}

export interface BillCalcResult {
  items: BillLineResult[];
  grossAmount: string;
  commissionPct: string;
  commissionAmount: string;
  freight: string;
  labour: string;
  marketFee: string;
  munshiyana: string;
  otherExpense: string;
  totalExpenses: string;
  netAmount: string;
  advanceAdjusted: string;
  finalPayable: string;
}

export function lineAmount(quantity: string, rate: string): string {
  return toMoneyString(D(quantity).times(D(rate)));
}

export function calculateBill(input: BillCalcInput): BillCalcResult {
  const items: BillLineResult[] = input.items.map((item) => ({
    itemName: item.itemName.trim(),
    size: item.size?.trim() ? item.size.trim() : null,
    quantity: toQtyString(item.quantity),
    unit: item.unit.trim() || "kg",
    rate: toMoneyString(item.rate),
    amount: lineAmount(item.quantity, item.rate),
  }));

  const gross = sum(items.map((i) => i.amount));
  const commissionPct = D(input.commissionPct);
  const commission = round2(gross.times(commissionPct).dividedBy(100));

  const freight = round2(input.freight);
  const labour = round2(input.labour);
  const marketFee = round2(input.marketFee);
  const munshiyana = round2(input.munshiyana);
  const otherExpense = round2(input.otherExpense);
  const totalExpenses = sum([freight, labour, marketFee, munshiyana, otherExpense]);

  const net = gross.minus(commission).minus(totalExpenses);
  const advanceAdjusted = round2(input.advanceAdjusted);
  const finalPayable = net.minus(advanceAdjusted);

  return {
    items,
    grossAmount: toMoneyString(gross),
    commissionPct: toPctString(commissionPct),
    commissionAmount: toMoneyString(commission),
    freight: toMoneyString(freight),
    labour: toMoneyString(labour),
    marketFee: toMoneyString(marketFee),
    munshiyana: toMoneyString(munshiyana),
    otherExpense: toMoneyString(otherExpense),
    totalExpenses: toMoneyString(totalExpenses),
    netAmount: toMoneyString(net),
    advanceAdjusted: toMoneyString(advanceAdjusted),
    finalPayable: toMoneyString(finalPayable),
  };
}

/** Running balance for SUPPLIER ledgers: opening + Σcredit − Σdebit (positive = payable to party). */
export function runningBalance(opening: string, rows: { debit: string; credit: string }[]): string[] {
  let balance = D(opening);
  return rows.map((row) => {
    balance = balance.plus(D(row.credit)).minus(D(row.debit));
    return toMoneyString(balance);
  });
}

/**
 * Running balance for CUSTOMER khatas: opening + Σdebit − Σcredit
 * (debit = goods given, credit = cash received; positive = due from the customer).
 */
export function runningDueBalance(opening: string, rows: { debit: string; credit: string }[]): string[] {
  let balance = D(opening);
  return rows.map((row) => {
    balance = balance.plus(D(row.debit)).minus(D(row.credit));
    return toMoneyString(balance);
  });
}

export interface SaleEntryCalcInput {
  quantity: string | null;
  rate: string | null;
  received: string;
}

export interface SaleEntryCalcResult {
  quantity: string | null;
  rate: string | null;
  /** Goods amount (debit) = quantity × rate, or 0.00 for a receipt-only row. */
  amount: string;
  /** Cash received (credit). */
  received: string;
}

/** Customer khata row: amount = qty × rate (when both given), received as typed. */
export function calculateSaleEntry(input: SaleEntryCalcInput): SaleEntryCalcResult {
  const hasGoods = input.quantity !== null && input.rate !== null && input.quantity !== "" && input.rate !== "";
  return {
    quantity: hasGoods ? toQtyString(input.quantity) : null,
    rate: hasGoods ? toMoneyString(input.rate) : null,
    amount: hasGoods ? lineAmount(input.quantity!, input.rate!) : "0.00",
    received: toMoneyString(input.received),
  };
}
