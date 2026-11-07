import { describe, expect, it } from "vitest";
import { calculateBill, lineAmount, runningBalance } from "@/lib/calc";

describe("calculateBill", () => {
  it("computes gross, commission, expenses, net and final payable exactly", () => {
    const result = calculateBill({
      items: [
        { itemName: "Tomato", quantity: "250", unit: "kg", rate: "48.50" },
        { itemName: "Onion", quantity: "100.5", unit: "kg", rate: "32" },
      ],
      commissionPct: "6",
      freight: "1200",
      labour: "350.50",
      marketFee: "120",
      munshiyana: "100",
      otherExpense: "0",
      advanceAdjusted: "5000",
    });

    expect(result.items[0].amount).toBe("12125.00"); // 250 × 48.50
    expect(result.items[1].amount).toBe("3216.00"); // 100.5 × 32
    expect(result.grossAmount).toBe("15341.00");
    expect(result.commissionPct).toBe("6.00");
    expect(result.commissionAmount).toBe("920.46"); // 15341 × 6% = 920.46
    expect(result.totalExpenses).toBe("1770.50");
    expect(result.netAmount).toBe("12650.04"); // 15341 − 920.46 − 1770.50
    expect(result.advanceAdjusted).toBe("5000.00");
    expect(result.finalPayable).toBe("7650.04");
  });

  it("rounds half-up at the paisa, never with binary float error", () => {
    // 0.1 + 0.2 style trap: 3 × 1.005 = 3.015 → 3.02 (half-up), not 3.01
    expect(lineAmount("3", "1.005")).toBe("3.02");
    const result = calculateBill({
      items: [{ itemName: "x", quantity: "1", unit: "kg", rate: "0.1" }, { itemName: "y", quantity: "1", unit: "kg", rate: "0.2" }],
      commissionPct: "0",
      freight: "0",
      labour: "0",
      marketFee: "0",
      munshiyana: "0",
      otherExpense: "0",
      advanceAdjusted: "0",
    });
    expect(result.grossAmount).toBe("0.30");
    expect(result.netAmount).toBe("0.30");
  });

  it("treats blank expense fields as zero and normalises quantities to 3 dp", () => {
    const result = calculateBill({
      items: [{ itemName: "Apple", quantity: "12.5", unit: "crate", rate: "1500" }],
      commissionPct: "5.5",
      freight: "",
      labour: "",
      marketFee: "",
      munshiyana: "",
      otherExpense: "",
      advanceAdjusted: "",
    });
    expect(result.items[0].quantity).toBe("12.500");
    expect(result.grossAmount).toBe("18750.00");
    expect(result.commissionAmount).toBe("1031.25");
    expect(result.totalExpenses).toBe("0.00");
    expect(result.netAmount).toBe("17718.75");
    expect(result.finalPayable).toBe("17718.75");
  });

  it("allows a negative final payable when the advance exceeds the net amount", () => {
    const result = calculateBill({
      items: [{ itemName: "Potato", quantity: "10", unit: "bag", rate: "100" }],
      commissionPct: "10",
      freight: "0",
      labour: "0",
      marketFee: "0",
      munshiyana: "0",
      otherExpense: "0",
      advanceAdjusted: "2000",
    });
    expect(result.netAmount).toBe("900.00");
    expect(result.finalPayable).toBe("-1100.00");
  });
});

describe("runningBalance", () => {
  it("applies opening + credit − debit in order", () => {
    const balances = runningBalance("-10000.00", [
      { debit: "0.00", credit: "45000.00" }, // bill credited
      { debit: "35000.00", credit: "0.00" }, // payment made
    ]);
    expect(balances).toEqual(["35000.00", "0.00"]);
  });
});
