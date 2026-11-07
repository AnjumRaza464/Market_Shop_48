"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { parties } from "@/db/schema";
import { D, toMoneyString, toPctString } from "@/lib/money";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { partySchema, type PartyInput } from "@/lib/validation/party";
import { describeError, requireSession } from "./guard";
import { errorState, successState, type ActionState } from "./types";

function toPartyValues(input: PartyInput) {
  const opening = D(input.openingBalance);
  return {
    name: input.name,
    contactPerson: input.contactPerson,
    phone: input.phone,
    address: input.address,
    mainItems: input.mainItems,
    commissionRate: toPctString(input.commissionRate),
    // DR = party owes the shop → stored negative; CR = shop owes the party → positive
    openingBalance: toMoneyString(input.openingBalanceSide === "DR" ? opening.negated() : opening),
    defaultFreight: toMoneyString(input.defaultFreight),
    defaultLabour: toMoneyString(input.defaultLabour),
    notes: input.notes,
    status: input.status,
  };
}

export async function createParty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = partySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }

  let id: number;
  try {
    const [row] = await db.insert(parties).values(toPartyValues(parsed.data)).returning({ id: parties.id });
    id = row.id;
  } catch (error) {
    return errorState(describeError(error, "Could not save the party."));
  }
  redirect(`/parties/${id}`);
}

export async function updateParty(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = partySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return errorState("Please fix the highlighted fields.", issuesToFieldErrors(parsed.error.issues));
  }

  try {
    const updated = await db
      .update(parties)
      .set(toPartyValues(parsed.data))
      .where(eq(parties.id, id))
      .returning({ id: parties.id });
    if (updated.length === 0) return errorState("Party not found.");
  } catch (error) {
    return errorState(describeError(error, "Could not update the party."));
  }
  redirect(`/parties/${id}`);
}

export async function deleteParty(id: number, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireSession();
  try {
    const deleted = await db.delete(parties).where(eq(parties.id, id)).returning({ id: parties.id });
    if (deleted.length === 0) return errorState("Party not found.");
  } catch (error) {
    return errorState(
      describeError(error, "Could not delete the party. Parties with bills or transactions can only be marked inactive."),
    );
  }
  redirect("/parties");
}

export async function setPartyStatus(
  id: number,
  status: "ACTIVE" | "INACTIVE",
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireSession();
  try {
    await db.update(parties).set({ status }).where(eq(parties.id, id));
  } catch (error) {
    return errorState(describeError(error, "Could not update the party status."));
  }
  refresh();
  return successState(status === "ACTIVE" ? "Party activated." : "Party marked inactive.");
}
