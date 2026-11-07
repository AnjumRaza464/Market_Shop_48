import { z } from "zod";
import { EXPENSE_CATEGORY_VALUES, PAYMENT_MODE_VALUES } from "@/lib/constants";
import { zISODate, zIdNullable, zOptionalText, zPositiveMoney } from "./common";

export const expenseSchema = z.object({
  expenseDate: zISODate,
  category: z.enum(EXPENSE_CATEGORY_VALUES, { message: "Select a category" }),
  amount: zPositiveMoney,
  paymentMode: z.enum(PAYMENT_MODE_VALUES).default("CASH"),
  /** Partner who paid from their own pocket; empty = shop cash box. */
  paidByPartnerId: zIdNullable,
  notes: zOptionalText(500),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
