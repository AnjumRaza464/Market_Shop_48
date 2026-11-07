import { describe, expect, it } from "vitest";
import { D, formatAmount, formatCompact, formatMoney, formatQty, sanitizeDecimalInput, sum, toMoneyString } from "@/lib/money";
import { formatDataToObjectFixture } from "./fixtures";
import { formDataToObject, issuesToFieldErrors } from "@/lib/validation/common";
import { billSchema } from "@/lib/validation/bill";
import { addDays, daysInMonth, formatDate, isValidISODate, monthRange } from "@/lib/dates";

describe("money", () => {
  it("parses strings with commas and ignores garbage", () => {
    expect(D("1,23,456.78").toString()).toBe("123456.78");
    expect(D("").toString()).toBe("0");
    expect(D("abc").toString()).toBe("0");
    expect(D(null).toString()).toBe("0");
  });

  it("formats in the Indian grouping system", () => {
    expect(formatAmount("1234567.5")).toBe("12,34,567.50");
    expect(formatMoney("-250")).toBe("-Rs 250.00");
    expect(formatMoney("250", { signed: true })).toBe("+Rs 250.00");
    expect(formatQty("1250.500")).toBe("1,250.5");
    expect(formatCompact("850")).toBe("850");
    expect(formatCompact("12000")).toBe("12K");
    expect(formatCompact("340000")).toBe("3.4L");
    expect(formatCompact("12500000")).toBe("1.3Cr");
  });

  it("sums exactly", () => {
    expect(toMoneyString(sum(["0.1", "0.2", "0.3"]))).toBe("0.60");
  });

  it("sanitises typed input", () => {
    expect(sanitizeDecimalInput("1,2a3.456")).toBe("123.45");
    expect(sanitizeDecimalInput("-12.5", { allowNegative: true })).toBe("-12.5");
    expect(sanitizeDecimalInput("-12.5")).toBe("12.5");
  });
});

describe("dates", () => {
  it("validates ISO dates including leap years", () => {
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2027-02-29")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(formatDate("2026-11-08")).toBe("08 Nov 2026");
    expect(monthRange(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("form parsing + bill validation", () => {
  it("builds nested objects from bracket-style field names", () => {
    const fd = formatDataToObjectFixture();
    const obj = formDataToObject(fd);
    expect(obj).toMatchObject({
      partyId: "3",
      billDate: "2026-11-08",
      items: [
        { itemName: "Tomato", quantity: "250", unit: "kg", rate: "48.5" },
        { itemName: "Onion", quantity: "100", unit: "bag", rate: "900" },
      ],
    });
  });

  it("accepts a valid bill and rejects an invalid one with path-keyed errors", () => {
    const ok = billSchema.safeParse(formDataToObject(formatDataToObjectFixture()));
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.freight).toBe("0"); // blank → "0"
      expect(ok.data.gariNumber).toBeNull();
    }

    const bad = billSchema.safeParse({
      partyId: "x",
      billDate: "2026-02-30",
      commissionPct: "150",
      freight: "",
      labour: "",
      marketFee: "",
      munshiyana: "",
      otherExpense: "",
      advanceAdjusted: "",
      items: [{ itemName: "", quantity: "0", unit: "kg", rate: "abc" }],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const errors = issuesToFieldErrors(bad.error.issues);
      expect(errors.partyId).toBeDefined();
      expect(errors.billDate).toBe("Enter a valid date");
      expect(errors.commissionPct).toBe("Percentage cannot exceed 100");
      expect(errors["items.0.itemName"]).toBe("Item name is required");
      expect(errors["items.0.quantity"]).toBe("Quantity must be greater than 0");
      expect(errors["items.0.rate"]).toBe("Enter a valid amount (max 2 decimals)");
    }
  });
});
