"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, type DbTransaction } from "@/db";
import { billItems, bills, parties, partyTransactions, type Bill } from "@/db/schema";
import { calculateBill, type BillCalcResult } from "@/lib/calc";
import { PAYMENT_MODE_VALUES } from "@/lib/constants";
import { D } from "@/lib/money";
import { billNumber } from "@/lib/utils";
import { billSchema, type BillInput } from "@/lib/validation/bill";
import { formDataToObject, issuesToFieldErrors, zISODate } from "@/lib/validation/common";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

/**
 * A patti normally credits the party with its net amount. When expenses exceed the sale value
 * the net is negative and the party owes the shop the shortfall, so it is posted as a debit.
 */
function ledgerSides(netAmount: string): { debit: string; credit: string } {
  const net = D(netAmount);
  return net.isNegative() ? { debit: net.abs().toFixed(2), credit: "0.00" } : { debit: "0.00", credit: net.toFixed(2) };
}

function billLedgerDescription(id: number, gariNumber: string | null, itemNames: string[]): string {
  const items = itemNames.slice(0, 3).join(", ") + (itemNames.length > 3 ? ` +${itemNames.length - 3} more` : "");
  return `Patti ${billNumber(id)}${gariNumber ? ` · Gari ${gariNumber}` : ""}${items ? ` · ${items}` : ""}`;
}

function billRow(input: BillInput, calc: BillCalcResult) {
  return {
    partyId: input.partyId,
    billDate: input.billDate,
    gariNumber: input.gariNumber,
    grossAmount: calc.grossAmount,
    commissionPct: calc.commissionPct,
    commissionAmount: calc.commissionAmount,
    freight: calc.freight,
    labour: calc.labour,
    marketFee: calc.marketFee,
    munshiyana: calc.munshiyana,
    otherExpense: calc.otherExpense,
    otherExpenseNote: D(calc.otherExpense).isZero() ? null : input.otherExpenseNote,
    totalExpenses: calc.totalExpenses,
    netAmount: calc.netAmount,
    advanceAdjusted: calc.advanceAdjusted,
    finalPayable: calc.finalPayable,
    notes: input.notes,
  };
}

async function insertItems(tx: DbTransaction, billId: number, calc: BillCalcResult) {
  await tx.insert(billItems).values(
    calc.items.map((item, index) => ({
      billId,
      lineNo: index + 1,
      itemName: item.itemName,
      size: item.size,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      amount: item.amount,
    })),
  );
}

async function parseBill(formData: FormData): Promise<
  { ok: true; input: BillInput; calc: BillCalcResult } | { ok: false; state: ActionState }
> {
  const parsed = billSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { ok: false, state: errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues)) };
  }
  const party = await db.query.parties.findFirst({ where: eq(parties.id, parsed.data.partyId) });
  if (!party) {
    return { ok: false, state: errorState("Please fix the highlighted fields.", { partyId: "Select a party" }) };
  }
  const calc = calculateBill(parsed.data);
  return { ok: true, input: parsed.data, calc };
}

export async function createBill(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const result = await parseBill(formData);
  if (!result.ok) return result.state;
  const { input, calc } = result;

  let id: number;
  try {
    id = await db.transaction(async (tx) => {
      const [bill] = await tx.insert(bills).values(billRow(input, calc)).returning({ id: bills.id });
      await insertItems(tx, bill.id, calc);
      await tx.insert(partyTransactions).values({
        partyId: input.partyId,
        txnDate: input.billDate,
        type: "BILL",
        ...ledgerSides(calc.netAmount),
        referenceId: bill.id,
        description: billLedgerDescription(
          bill.id,
          input.gariNumber,
          calc.items.map((i) => i.itemName),
        ),
      });
      return bill.id;
    });
  } catch (error) {
    return errorState(describeError(error, "Could not save the bill."));
  }
  redirect(`/bills/${id}`);
}

export async function updateBill(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) return errorState("Bill not found.");
  if (existing.status !== "PENDING") {
    return errorState("Only pending bills can be edited. Undo the payment or restore the bill first.");
  }

  const result = await parseBill(formData);
  if (!result.ok) return result.state;
  const { input, calc } = result;

  try {
    await db.transaction(async (tx) => {
      await tx.update(bills).set(billRow(input, calc)).where(eq(bills.id, id));
      await tx.delete(billItems).where(eq(billItems.billId, id));
      await insertItems(tx, id, calc);

      const ledger = {
        partyId: input.partyId,
        txnDate: input.billDate,
        ...ledgerSides(calc.netAmount),
        description: billLedgerDescription(
          id,
          input.gariNumber,
          calc.items.map((i) => i.itemName),
        ),
      };
      const updated = await tx
        .update(partyTransactions)
        .set(ledger)
        .where(and(eq(partyTransactions.referenceId, id), eq(partyTransactions.type, "BILL")))
        .returning({ id: partyTransactions.id });
      if (updated.length === 0) {
        await tx.insert(partyTransactions).values({ ...ledger, type: "BILL", referenceId: id });
      }
    });
  } catch (error) {
    return errorState(describeError(error, "Could not update the bill."));
  }
  redirect(`/bills/${id}`);
}

export async function deleteBill(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) return errorState("Bill not found.");
  if (existing.status === "PAID") {
    return errorState("Paid bills cannot be deleted. Undo the payment first.");
  }
  try {
    // bill_items and party_transactions cascade on delete
    await db.delete(bills).where(eq(bills.id, id));
  } catch (error) {
    return errorState(describeError(error, "Could not delete the bill."));
  }
  redirect("/bills");
}

const markPaidSchema = z.object({
  paymentDate: zISODate,
  paymentMode: z.enum(PAYMENT_MODE_VALUES).default("CASH"),
});

/** Mark a pending bill as paid and record the cash/bank payment in the party ledger. */
export async function markBillPaid(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = markPaidSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) return errorState("Bill not found.");
  if (existing.status !== "PENDING") return errorState("Only pending bills can be marked as paid.");

  try {
    await db.transaction(async (tx) => {
      if (D(existing.finalPayable).greaterThan(0)) {
        await tx.insert(partyTransactions).values({
          partyId: existing.partyId,
          txnDate: parsed.data.paymentDate,
          type: "PAYMENT",
          debit: existing.finalPayable,
          credit: "0.00",
          referenceId: id,
          paymentMode: parsed.data.paymentMode,
          description: `Payment for patti ${billNumber(id)}`,
        });
      }
      await tx.update(bills).set({ status: "PAID" }).where(eq(bills.id, id));
    });
  } catch (error) {
    return errorState(describeError(error, "Could not record the payment."));
  }
  refresh();
  return successState("Bill marked as paid and payment recorded in the party ledger.");
}

export async function undoBillPayment(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) return errorState("Bill not found.");
  if (existing.status !== "PAID") return errorState("This bill is not marked as paid.");

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(partyTransactions)
        .where(and(eq(partyTransactions.referenceId, id), eq(partyTransactions.type, "PAYMENT")));
      await tx.update(bills).set({ status: "PENDING" }).where(eq(bills.id, id));
    });
  } catch (error) {
    return errorState(describeError(error, "Could not undo the payment."));
  }
  refresh();
  return successState("Payment removed. The bill is pending again.");
}

/** Cancel a pending bill: removes its ledger credit so the party balance is unaffected. */
export async function cancelBill(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) return errorState("Bill not found.");
  if (existing.status !== "PENDING") return errorState("Only pending bills can be cancelled.");

  try {
    await db.transaction(async (tx) => {
      await tx.delete(partyTransactions).where(eq(partyTransactions.referenceId, id));
      await tx.update(bills).set({ status: "CANCELLED" }).where(eq(bills.id, id));
    });
  } catch (error) {
    return errorState(describeError(error, "Could not cancel the bill."));
  }
  refresh();
  return successState("Bill cancelled.");
}

export async function restoreBill(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  const existing: (Bill & { items: { itemName: string }[] }) | undefined = await db.query.bills.findFirst({
    where: eq(bills.id, id),
    with: { items: { columns: { itemName: true } } },
  });
  if (!existing) return errorState("Bill not found.");
  if (existing.status !== "CANCELLED") return errorState("Only cancelled bills can be restored.");

  try {
    await db.transaction(async (tx) => {
      await tx.insert(partyTransactions).values({
        partyId: existing.partyId,
        txnDate: existing.billDate,
        type: "BILL",
        ...ledgerSides(existing.netAmount),
        referenceId: id,
        description: billLedgerDescription(
          id,
          existing.gariNumber,
          existing.items.map((i) => i.itemName),
        ),
      });
      await tx.update(bills).set({ status: "PENDING" }).where(eq(bills.id, id));
    });
  } catch (error) {
    return errorState(describeError(error, "Could not restore the bill."));
  }
  refresh();
  return successState("Bill restored and credited to the party ledger again.");
}
