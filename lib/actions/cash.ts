"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cashEntries, partners } from "@/db/schema";
import { toMoneyString } from "@/lib/money";
import { cashEntrySchema, type CashEntryInput } from "@/lib/validation/cash";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

async function toValues(input: CashEntryInput): Promise<{ ok: true; values: typeof cashEntries.$inferInsert } | { ok: false; state: ActionState }> {
  if (input.partnerId !== null) {
    const partner = await db.query.partners.findFirst({ where: eq(partners.id, input.partnerId) });
    if (!partner) return { ok: false, state: errorState("Please fix the highlighted fields.", { partnerId: "Select a valid partner" }) };
  }
  return {
    ok: true,
    values: {
      entryDate: input.entryDate,
      type: input.type,
      direction: input.direction,
      amount: toMoneyString(input.amount),
      paymentMode: input.paymentMode,
      toMode: input.toMode,
      partnerId: input.partnerId,
      notes: input.notes,
    },
  };
}

export async function createCashEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = cashEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  const prepared = await toValues(parsed.data);
  if (!prepared.ok) return prepared.state;
  let id: number;
  try {
    const [row] = await db.insert(cashEntries).values(prepared.values).returning({ id: cashEntries.id });
    id = row.id;
  } catch (error) {
    return errorState(describeError(error, "Could not save the cash entry."));
  }
  refresh();
  const v = prepared.values;
  const verb = v.type === "TRANSFER" ? "moved" : v.direction === "IN" ? "added to" : "taken out of";
  return successState(`${v.amount} ${verb} ${v.type === "TRANSFER" ? `${v.paymentMode} → ${v.toMode}` : v.paymentMode}.`, id);
}

export async function updateCashEntry(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = cashEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  const prepared = await toValues(parsed.data);
  if (!prepared.ok) return prepared.state;
  try {
    const updated = await db.update(cashEntries).set(prepared.values).where(eq(cashEntries.id, id)).returning({ id: cashEntries.id });
    if (updated.length === 0) return errorState("Cash entry not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not update the cash entry."));
  }
  redirect("/cash");
}

export async function deleteCashEntry(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    const deleted = await db.delete(cashEntries).where(eq(cashEntries.id, id)).returning({ id: cashEntries.id });
    if (deleted.length === 0) return errorState("Cash entry not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not delete the cash entry."));
  }
  refresh();
  return successState("Cash entry deleted.");
}
