import { describe, expect, it } from "vitest";
import { calculateSaleEntry, runningDueBalance } from "@/lib/calc";
import { saleEntrySchema } from "@/lib/validation/sale";
import { customerSchema } from "@/lib/validation/customer";

describe("customer khata – calculateSaleEntry", () => {
  it("amount = qty × rate, received as typed", () => {
    const r = calculateSaleEntry({ quantity: "115", rate: "2750", received: "316200" });
    expect(r.quantity).toBe("115.000");
    expect(r.rate).toBe("2750.00");
    expect(r.amount).toBe("316250.00");
    expect(r.received).toBe("316200.00");
  });

  it("receipt-only row has no goods amount", () => {
    const r = calculateSaleEntry({ quantity: null, rate: null, received: "5000" });
    expect(r.quantity).toBeNull();
    expect(r.rate).toBeNull();
    expect(r.amount).toBe("0.00");
    expect(r.received).toBe("5000.00");
  });

  it("rounds half-up at the paisa", () => {
    expect(calculateSaleEntry({ quantity: "3", rate: "1.005", received: "" }).amount).toBe("3.02");
    expect(calculateSaleEntry({ quantity: "12.5", rate: "1500", received: "" }).amount).toBe("18750.00");
  });
});

describe("customer khata – runningDueBalance", () => {
  it("applies opening + goods − received in order (Khaata sheet: Balance = Opening + Debit − Credit)", () => {
    const balances = runningDueBalance("128000.00", [
      { debit: "316250.00", credit: "316200.00" }, // goods + cash on the same row
      { debit: "0.00", credit: "100000.00" }, // payment only
      { debit: "50000.00", credit: "0.00" }, // goods only
    ]);
    expect(balances).toEqual(["128050.00", "28050.00", "78050.00"]);
  });

  it("goes negative when the customer has paid in advance", () => {
    expect(runningDueBalance("0.00", [{ debit: "0.00", credit: "2500.00" }])).toEqual(["-2500.00"]);
  });
});

describe("saleEntrySchema", () => {
  const base = { customerId: "3", entryDate: "2026-11-08", itemName: "", quantity: "", unit: "", rate: "", received: "", paymentMode: "CASH", reference: "", remarks: "" };

  it("accepts a goods row", () => {
    const r = saleEntrySchema.safeParse({ ...base, itemName: "Kinnow", quantity: "40", unit: "crate", rate: "1,200" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.quantity).toBe("40");
      expect(r.data.rate).toBe("1200");
      expect(r.data.received).toBe("0");
    }
  });

  it("accepts a receipt-only row", () => {
    const r = saleEntrySchema.safeParse({ ...base, received: "15000", paymentMode: "JAZZCASH" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paymentMode).toBe("JAZZCASH");
  });

  it("rejects an empty row", () => {
    const r = saleEntrySchema.safeParse(base);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join(".") === "received")).toBe(true);
  });

  it("requires qty and rate once an item is typed", () => {
    const r = saleEntrySchema.safeParse({ ...base, itemName: "Mango" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("quantity");
      expect(paths).toContain("rate");
    }
  });
});

describe("customerSchema", () => {
  it("defaults the opening balance side to DUE and trims optional text to null", () => {
    const r = customerSchema.safeParse({ name: "Sheikh Brothers", contactPerson: "", phone: "0301-9990608", city: "Bahawalpur", address: "", openingBalance: "", notes: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.openingBalanceSide).toBe("DUE");
      expect(r.data.openingBalance).toBe("0");
      expect(r.data.contactPerson).toBeNull();
      expect(r.data.status).toBe("ACTIVE");
    }
  });
});
