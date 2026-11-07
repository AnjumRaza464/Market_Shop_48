import { z } from "zod";
import { PAYMENT_MODE_VALUES } from "@/lib/constants";
import { D } from "@/lib/money";
import { zISODate, zId, zMoneyNullable, zMoneyOptional, zOptionalText, zQtyNullable } from "./common";

/**
 * One customer khata row, exactly like the Khaata sheet: goods given (item × qty × rate)
 * and/or cash received. Either part may be left blank, but not both.
 */
export const saleEntrySchema = z
  .object({
    customerId: zId,
    entryDate: zISODate,
    itemName: zOptionalText(120),
    quantity: zQtyNullable,
    unit: zOptionalText(20),
    rate: zMoneyNullable,
    received: zMoneyOptional,
    paymentMode: z
      .enum([...PAYMENT_MODE_VALUES, ""])
      .optional()
      .transform((v) => (v ? v : null)),
    reference: zOptionalText(50),
    remarks: zOptionalText(500),
  })
  .superRefine((v, ctx) => {
    const hasGoods = v.quantity !== null || v.rate !== null || v.itemName !== null;
    const hasReceipt = D(v.received).greaterThan(0);
    if (hasGoods) {
      if (v.itemName === null) ctx.addIssue({ code: "custom", path: ["itemName"], message: "Enter the item" });
      if (v.quantity === null) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter the quantity" });
      if (v.rate === null) ctx.addIssue({ code: "custom", path: ["rate"], message: "Enter the rate" });
    }
    if (!hasGoods && !hasReceipt) {
      ctx.addIssue({ code: "custom", path: ["received"], message: "Enter goods (item, qty, rate) or an amount received" });
    }
  });

export type SaleEntryInput = z.infer<typeof saleEntrySchema>;
