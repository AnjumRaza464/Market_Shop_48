"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { D, toMoneyString } from "@/lib/money";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { customerSchema, type CustomerInput } from "@/lib/validation/customer";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

function toCustomerValues(input: CustomerInput) {
  const opening = D(input.openingBalance);
  return {
    name: input.name,
    contactPerson: input.contactPerson,
    phone: input.phone,
    city: input.city,
    address: input.address,
    // DUE = customer owes the shop → stored positive; ADVANCE = customer paid ahead → negative
    openingBalance: toMoneyString(input.openingBalanceSide === "ADVANCE" ? opening.negated() : opening),
    notes: input.notes,
    status: input.status,
  };
}

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = customerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }

  let id: number;
  try {
    const [row] = await db.insert(customers).values(toCustomerValues(parsed.data)).returning({ id: customers.id });
    id = row.id;
  } catch (error) {
    return errorState(describeError(error, "Could not save the customer."));
  }
  redirect(`/customers/${id}`);
}

export async function updateCustomer(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = customerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }

  try {
    const updated = await db
      .update(customers)
      .set(toCustomerValues(parsed.data))
      .where(eq(customers.id, id))
      .returning({ id: customers.id });
    if (updated.length === 0) return errorState("Customer not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not update the customer."));
  }
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    const deleted = await db.delete(customers).where(eq(customers.id, id)).returning({ id: customers.id });
    if (deleted.length === 0) return errorState("Customer not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not delete the customer. Customers with khata entries can only be marked inactive."));
  }
  redirect("/customers");
}

export async function setCustomerStatus(
  id: number,
  status: "ACTIVE" | "INACTIVE",
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireSession();
  try {
    await db.update(customers).set({ status }).where(eq(customers.id, id));
  } catch (error) {
    return errorState(describeError(error, "Could not update the customer status."));
  }
  refresh();
  return successState(status === "ACTIVE" ? "Customer activated." : "Customer marked inactive.");
}
