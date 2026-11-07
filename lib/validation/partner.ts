import { z } from "zod";
import { zOptionalText, zPct } from "./common";

export const partnerSchema = z.object({
  name: z.string().trim().min(2, "Partner name must be at least 2 characters").max(120, "Name is too long"),
  sharePct: zPct,
  phone: zOptionalText(30),
  notes: zOptionalText(500),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type PartnerInput = z.infer<typeof partnerSchema>;
