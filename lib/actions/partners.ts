"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { toPctString } from "@/lib/money";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { partnerSchema, type PartnerInput } from "@/lib/validation/partner";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

function toPartnerValues(input: PartnerInput) {
  return {
    name: input.name,
    sharePct: toPctString(input.sharePct),
    phone: input.phone,
    notes: input.notes,
    status: input.status,
  };
}

export async function createPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = partnerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  try {
    await db.insert(partners).values(toPartnerValues(parsed.data));
  } catch (error) {
    return errorState(describeError(error, "Could not save the partner."));
  }
  refresh();
  return successState("Partner added.");
}

export async function updatePartner(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = partnerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }
  try {
    const updated = await db.update(partners).set(toPartnerValues(parsed.data)).where(eq(partners.id, id)).returning({ id: partners.id });
    if (updated.length === 0) return errorState("Partner not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not update the partner."));
  }
  redirect("/partners");
}

/** Deleting a partner keeps their expenses (paid_by becomes "shop cash box"). */
export async function deletePartner(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    const deleted = await db.delete(partners).where(eq(partners.id, id)).returning({ id: partners.id });
    if (deleted.length === 0) return errorState("Partner not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not delete the partner."));
  }
  refresh();
  return successState("Partner deleted. Their expenses now count as paid from the shop cash box.");
}
