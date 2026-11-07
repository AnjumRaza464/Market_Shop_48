import { z } from "zod";
import { PAYMENT_MODE_VALUES } from "@/lib/constants";
import { zISODate, zId, zOptionalText, zPositiveMoney } from "./common";

export const transactionSchema = z
  .object({
    partyId: zId,
    txnDate: zISODate,
    type: z.enum(["PAYMENT", "ADVANCE", "RECEIPT", "ADJUSTMENT"], { message: "Select a transaction type" }),
    amount: zPositiveMoney,
    /** Only used for ADJUSTMENT: which side of the ledger the amount goes to. */
    side: z.enum(["DEBIT", "CREDIT"]).optional(),
    paymentMode: z
      .enum([...PAYMENT_MODE_VALUES, ""])
      .optional()
      .transform((v) => (v ? v : null)),
    description: zOptionalText(500),
  })
  .refine((v) => v.type !== "ADJUSTMENT" || v.side !== undefined, {
    message: "Choose whether the adjustment is a debit or a credit",
    path: ["side"],
  });

export type TransactionInput = z.infer<typeof transactionSchema>;
