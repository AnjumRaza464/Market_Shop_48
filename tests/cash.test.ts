import { describe, expect, it } from "vitest";
import { cashEntrySchema, directionFor } from "@/lib/validation/cash";

describe("cash book – directionFor", () => {
  it("opening and deposits add cash, withdrawals and transfers remove it", () => {
    expect(directionFor("OPENING", "OUT")).toBe("IN");
    expect(directionFor("DEPOSIT", "OUT")).toBe("IN");
    expect(directionFor("WITHDRAWAL", "IN")).toBe("OUT");
    expect(directionFor("TRANSFER", "IN")).toBe("OUT");
  });

  it("adjustments keep the side the user picked", () => {
    expect(directionFor("ADJUSTMENT", "IN")).toBe("IN");
    expect(directionFor("ADJUSTMENT", "OUT")).toBe("OUT");
  });
});

describe("cashEntrySchema", () => {
  const base = { entryDate: "2026-11-12", type: "DEPOSIT", amount: "25,000", paymentMode: "CASH", toMode: "", direction: "IN", partnerId: "", notes: "" };

  it("accepts a deposit and strips commas from the amount", () => {
    const r = cashEntrySchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBe("25000");
      expect(r.data.direction).toBe("IN");
      expect(r.data.toMode).toBeNull();
      expect(r.data.partnerId).toBeNull();
    }
  });

  it("keeps the partner only for deposits / withdrawals", () => {
    const dep = cashEntrySchema.safeParse({ ...base, partnerId: "2" });
    expect(dep.success && dep.data.partnerId).toBe(2);
    const opening = cashEntrySchema.safeParse({ ...base, type: "OPENING", partnerId: "2" });
    expect(opening.success && opening.data.partnerId).toBeNull();
  });

  it("a transfer needs a different destination account", () => {
    const missing = cashEntrySchema.safeParse({ ...base, type: "TRANSFER" });
    expect(missing.success).toBe(false);
    const same = cashEntrySchema.safeParse({ ...base, type: "TRANSFER", toMode: "CASH" });
    expect(same.success).toBe(false);
    const ok = cashEntrySchema.safeParse({ ...base, type: "TRANSFER", toMode: "BANK" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.direction).toBe("OUT");
      expect(ok.data.toMode).toBe("BANK");
    }
  });

  it("drops a stray destination on a non-transfer and rejects zero amounts", () => {
    const stray = cashEntrySchema.safeParse({ ...base, toMode: "BANK" });
    expect(stray.success && stray.data.toMode).toBeNull();
    expect(cashEntrySchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });

  it("adjustment honours the chosen side", () => {
    const out = cashEntrySchema.safeParse({ ...base, type: "ADJUSTMENT", direction: "OUT" });
    expect(out.success && out.data.direction).toBe("OUT");
  });
});
