import { z } from "zod";
import { zISODate, zId, zMoney, zMoneyOptional, zOptionalText, zPct, zQty } from "./common";

export const billItemSchema = z.object({
  itemName: z.string().trim().min(1, "Item name is required").max(120, "Item name is too long"),
  /** Size / count (dana) – optional, one line per size on multi-size lots. */
  size: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim())
    .pipe(z.string().max(40, "Size is too long"))
    .transform((s) => (s.length ? s : null)),
  quantity: zQty,
  unit: z
    .string()
    .trim()
    .max(20, "Unit is too long")
    .transform((s) => s || "kg"),
  rate: zMoney,
});

export const billSchema = z.object({
  partyId: zId,
  billDate: zISODate,
  gariNumber: zOptionalText(50),
  commissionPct: zPct,
  freight: zMoneyOptional,
  labour: zMoneyOptional,
  marketFee: zMoneyOptional,
  munshiyana: zMoneyOptional,
  otherExpense: zMoneyOptional,
  otherExpenseNote: zOptionalText(120),
  advanceAdjusted: zMoneyOptional,
  notes: zOptionalText(1000),
  items: z.array(billItemSchema).min(1, "Add at least one item line").max(60, "Too many item lines"),
});

export type BillInput = z.infer<typeof billSchema>;
export type BillItemInput = z.infer<typeof billItemSchema>;
