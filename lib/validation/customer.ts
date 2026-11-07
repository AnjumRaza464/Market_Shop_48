import { z } from "zod";
import { zMoneyOptional, zOptionalText } from "./common";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name must be at least 2 characters").max(120, "Name is too long"),
  contactPerson: zOptionalText(120),
  phone: zOptionalText(30),
  city: zOptionalText(120),
  address: zOptionalText(500),
  openingBalance: zMoneyOptional,
  /** DUE = customer owes the shop (old udhaar), ADVANCE = customer has paid ahead. */
  openingBalanceSide: z.enum(["DUE", "ADVANCE"]).default("DUE"),
  notes: zOptionalText(1000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
