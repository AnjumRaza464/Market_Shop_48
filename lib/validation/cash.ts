import { z } from "zod";
import type { CashDirection, CashEntryType } from "@/db/schema";
import { CASH_ENTRY_TYPE_VALUES, PAYMENT_MODE_VALUES } from "@/lib/constants";
import { zISODate, zIdNullable, zOptionalText, zPositiveMoney } from "./common";

/**
 * Manual cash-book entry. The direction is derived from the type except for ADJUSTMENT,
 * where the user picks it; a TRANSFER always leaves `paymentMode` and arrives in `toMode`.
 */
export const cashEntrySchema = z
  .object({
    entryDate: zISODate,
    type: z.enum(CASH_ENTRY_TYPE_VALUES, { message: "Select an entry type" }),
    amount: zPositiveMoney,
    paymentMode: z.enum(PAYMENT_MODE_VALUES).default("CASH"),
    toMode: z
      .string()
      .optional()
      .transform((v) => (v && v.length ? v : null))
      .pipe(z.enum(PAYMENT_MODE_VALUES).nullable()),
    /** Only read for ADJUSTMENT. */
    direction: z.enum(["IN", "OUT"]).default("IN"),
    partnerId: zIdNullable,
    notes: zOptionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.type === "TRANSFER") {
      if (!v.toMode) ctx.addIssue({ code: "custom", path: ["toMode"], message: "Select where the money went" });
      else if (v.toMode === v.paymentMode) ctx.addIssue({ code: "custom", path: ["toMode"], message: "Choose a different account" });
    }
  })
  .transform((v) => ({
    entryDate: v.entryDate,
    type: v.type,
    direction: directionFor(v.type, v.direction),
    amount: v.amount,
    paymentMode: v.paymentMode,
    toMode: v.type === "TRANSFER" ? v.toMode : null,
    partnerId: v.type === "DEPOSIT" || v.type === "WITHDRAWAL" ? v.partnerId : null,
    notes: v.notes,
  }));

export type CashEntryInput = z.infer<typeof cashEntrySchema>;

export function directionFor(type: CashEntryType, chosen: CashDirection): CashDirection {
  switch (type) {
    case "OPENING":
    case "DEPOSIT":
      return "IN";
    case "WITHDRAWAL":
    case "TRANSFER":
      return "OUT";
    case "ADJUSTMENT":
      return chosen;
  }
}
