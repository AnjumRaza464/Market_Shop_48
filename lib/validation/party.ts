import { z } from "zod";
import { zMoneyOptional, zOptionalText, zPct } from "./common";

export const partySchema = z.object({
  name: z.string().trim().min(2, "Party name must be at least 2 characters").max(120, "Name is too long"),
  contactPerson: zOptionalText(120),
  phone: zOptionalText(30),
  address: zOptionalText(500),
  mainItems: zOptionalText(200),
  commissionRate: zPct,
  openingBalance: zMoneyOptional,
  /** CR = shop owes the party (payable), DR = party owes the shop (receivable). */
  openingBalanceSide: z.enum(["CR", "DR"]).default("CR"),
  defaultFreight: zMoneyOptional,
  defaultLabour: zMoneyOptional,
  notes: zOptionalText(1000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type PartyInput = z.infer<typeof partySchema>;
