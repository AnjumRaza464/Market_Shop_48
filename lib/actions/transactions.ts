"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { parties, partyTransactions } from "@/db/schema";
import { toMoneyString } from "@/lib/money";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { transactionSchema } from "@/lib/validation/transaction";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function createTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const raw = formDataToObject(formData);
  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  const data = parsed.data;

  const party = await db.query.parties.findFirst({ where: eq(parties.id, data.partyId) });
  if (!party) return errorState("Please fix the highlighted fields.", { partyId: "Select a party" });

  const amount = toMoneyString(data.amount);
  let debit = "0.00";
  let credit = "0.00";
  switch (data.type) {
    case "PAYMENT":
    case "ADVANCE":
      debit = amount; // money went out to the party → party owes us more / we owe less
      break;
    case "RECEIPT":
      credit = amount; // money came in from the party
      break;
    case "ADJUSTMENT":
      if (data.side === "DEBIT") debit = amount;
      else credit = amount;
      break;
  }

  try {
    await db.insert(partyTransactions).values({
      partyId: data.partyId,
      txnDate: data.txnDate,
      type: data.type,
      debit,
      credit,
      paymentMode: data.type === "ADJUSTMENT" ? null : data.paymentMode,
      description: data.description,
    });
  } catch (error) {
    return errorState(describeError(error, "Could not save the transaction."));
  }
  redirect(safeReturnTo(raw.returnTo, `/parties/${data.partyId}`));
}

export async function deleteTransaction(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  const existing = await db.query.partyTransactions.findFirst({ where: eq(partyTransactions.id, id) });
  if (!existing) return errorState("Transaction not found.");
  if (existing.type === "BILL") return errorState("Bill entries are managed from the bill itself.");
  if (existing.referenceId) {
    return errorState("This payment belongs to a bill. Open the bill and use “Undo payment” instead.");
  }
  try {
    await db.delete(partyTransactions).where(eq(partyTransactions.id, id));
  } catch (error) {
    return errorState(describeError(error, "Could not delete the transaction."));
  }
  refresh();
  return successState("Transaction deleted.");
}
