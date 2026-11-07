"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { customers, saleEntries } from "@/db/schema";
import { calculateSaleEntry } from "@/lib/calc";
import { D } from "@/lib/money";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { saleEntrySchema, type SaleEntryInput } from "@/lib/validation/sale";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function toEntryValues(input: SaleEntryInput) {
  const calc = calculateSaleEntry({ quantity: input.quantity, rate: input.rate, received: input.received });
  const hasGoods = D(calc.amount).greaterThan(0);
  const hasReceipt = D(calc.received).greaterThan(0);
  return {
    customerId: input.customerId,
    entryDate: input.entryDate,
    itemName: hasGoods ? input.itemName : null,
    quantity: calc.quantity,
    unit: hasGoods ? (input.unit ?? "crate") : null,
    rate: calc.rate,
    amount: calc.amount,
    received: calc.received,
    // A payment mode only makes sense when money changed hands; default to cash.
    paymentMode: hasReceipt ? (input.paymentMode ?? "CASH") : null,
    reference: input.reference,
    remarks: input.remarks,
  };
}

async function parseEntry(formData: FormData): Promise<{ ok: true; input: SaleEntryInput } | { ok: false; state: ActionState }> {
  const parsed = saleEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { ok: false, state: errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues)) };
  }
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, parsed.data.customerId) });
  if (!customer) {
    return { ok: false, state: errorState("Please fix the highlighted fields.", { customerId: "Select a customer" }) };
  }
  return { ok: true, input: parsed.data };
}

/** Quick entry: saves and stays on the page so the next row can be typed immediately. */
export async function createSaleEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const result = await parseEntry(formData);
  if (!result.ok) return result.state;

  let id: number;
  try {
    const [row] = await db.insert(saleEntries).values(toEntryValues(result.input)).returning({ id: saleEntries.id });
    id = row.id;
  } catch (error) {
    return errorState(describeError(error, "Could not save the entry."));
  }
  refresh();
  const values = toEntryValues(result.input);
  const parts = [];
  if (D(values.amount).greaterThan(0)) parts.push(`goods ${values.amount}`);
  if (D(values.received).greaterThan(0)) parts.push(`received ${values.received}`);
  return successState(`Entry saved (${parts.join(", ")}).`, id);
}

export async function updateSaleEntry(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const result = await parseEntry(formData);
  if (!result.ok) return result.state;

  try {
    const updated = await db
      .update(saleEntries)
      .set(toEntryValues(result.input))
      .where(eq(saleEntries.id, id))
      .returning({ id: saleEntries.id });
    if (updated.length === 0) return errorState("Entry not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not update the entry."));
  }
  redirect(safeReturnTo(formData.get("returnTo"), `/customers/${result.input.customerId}`));
}

export async function deleteSaleEntry(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    const deleted = await db.delete(saleEntries).where(eq(saleEntries.id, id)).returning({ id: saleEntries.id });
    if (deleted.length === 0) return errorState("Entry not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not delete the entry."));
  }
  refresh();
  return successState("Entry deleted.");
}
