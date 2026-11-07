"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { partners, shopExpenses } from "@/db/schema";
import { toMoneyString } from "@/lib/money";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { expenseSchema, type ExpenseInput } from "@/lib/validation/expense";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

async function toExpenseValues(input: ExpenseInput): Promise<{ ok: true; values: typeof shopExpenses.$inferInsert } | { ok: false; state: ActionState }> {
  if (input.paidByPartnerId !== null) {
    const partner = await db.query.partners.findFirst({ where: eq(partners.id, input.paidByPartnerId) });
    if (!partner) return { ok: false, state: errorState("Please fix the highlighted fields.", { paidByPartnerId: "Select a valid partner" }) };
  }
  return {
    ok: true,
    values: {
      expenseDate: input.expenseDate,
      category: input.category,
      amount: toMoneyString(input.amount),
      paymentMode: input.paymentMode,
      paidByPartnerId: input.paidByPartnerId,
      notes: input.notes,
    },
  };
}

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = expenseSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  const prepared = await toExpenseValues(parsed.data);
  if (!prepared.ok) return prepared.state;
  let id: number;
  try {
    const [row] = await db.insert(shopExpenses).values(prepared.values).returning({ id: shopExpenses.id });
    id = row.id;
  } catch (error) {
    return errorState(describeError(error, "Could not save the expense."));
  }
  refresh();
  return successState("Expense saved.", id);
}

export async function updateExpense(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = expenseSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  const prepared = await toExpenseValues(parsed.data);
  if (!prepared.ok) return prepared.state;
  try {
    const updated = await db.update(shopExpenses).set(prepared.values).where(eq(shopExpenses.id, id)).returning({ id: shopExpenses.id });
    if (updated.length === 0) return errorState("Expense not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not update the expense."));
  }
  redirect("/expenses");
}

export async function deleteExpense(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    await db.delete(shopExpenses).where(eq(shopExpenses.id, id));
  } catch (error) {
    return errorState(describeError(error, "Could not delete the expense."));
  }
  refresh();
  return successState("Expense deleted.");
}
