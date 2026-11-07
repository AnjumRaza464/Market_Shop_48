/**
 * Demo data for Market 48 Shop.
 *
 *   npm run db:seed                       → seeds every module whose tables are still empty
 *   npm run db:seed -- --force            → wipes ALL tables and re-seeds everything
 *   npm run db:seed -- --reset-customers  → wipes only customers + sale entries, re-seeds them
 *   npm run db:seed -- --reset-partners   → wipes only partners (expenses keep their rows, paid_by → shop)
 *
 * Supplier side: 8 parties, ~11 months of bills (Jan–Nov 2026) with line items, payments, advances.
 * Customer side: 10 customers with goods-given / cash-received rows (Khaata sheet style).
 * Shop: monthly expenses, 2 partners (paid-by is assigned to existing expenses when partners are created).
 * Deterministic (seeded PRNG) so re-runs match.
 */
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billItems,
  bills,
  customers,
  parties,
  partners,
  partyTransactions,
  saleEntries,
  shopExpenses,
  type ExpenseCategory,
  type PaymentMode,
} from "@/db/schema";
import { calculateBill, calculateSaleEntry } from "@/lib/calc";
import { addDays, daysInMonth } from "@/lib/dates";
import { D, toMoneyString } from "@/lib/money";
import { billNumber } from "@/lib/utils";

const TODAY = "2026-11-08";
const YEAR = 2026;
const LAST_MONTH = Number(TODAY.slice(5, 7));

// ---------- deterministic PRNG ----------
let seed = 48;
function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(arr: T[]): T => arr[intBetween(0, arr.length - 1)];
const chance = (p: number) => rand() < p;
const money = (n: number) => toMoneyString(n);
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const MODES: PaymentMode[] = ["CASH", "CASH", "CASH", "BANK", "JAZZCASH", "EASYPAISA"];

// ---------- reference data ----------
const PARTIES = [
  { name: "Haji Rafiq & Sons", contact: "Haji Rafiq", phone: "0300-1234567", address: "Pattoki", items: "Tomato, Onion", rate: "6.00", opening: "0.00", freight: "2500", labour: "600" },
  { name: "Malik Traders", contact: "Malik Asif", phone: "0321-7654321", address: "Okara", items: "Potato, Garlic", rate: "5.00", opening: "18500.00", freight: "3000", labour: "800" },
  { name: "Chaudhry Fruit Co.", contact: "Ch. Nadeem", phone: "0333-9988776", address: "Sargodha", items: "Kinnow, Orange", rate: "7.00", opening: "-25000.00", freight: "4500", labour: "1000" },
  { name: "Bismillah Sabzi Supplier", contact: "Irfan", phone: "0345-1122334", address: "Kasur", items: "Green Chilli, Lemon", rate: "6.00", opening: "0.00", freight: "1800", labour: "500" },
  { name: "Al-Madina Traders", contact: "Shahid Mehmood", phone: "0301-5566778", address: "Multan", items: "Mango, Dates", rate: "5.50", opening: "0.00", freight: "5000", labour: "900" },
  { name: "Sardar Vegetable Farm", contact: "Sardar Gul", phone: "0312-4455667", address: "Swat", items: "Peach, Apple", rate: "6.00", opening: "-12000.00", freight: "6500", labour: "1200" },
  { name: "Khan Brothers", contact: "Asad Khan", phone: "0334-2233445", address: "Peshawar", items: "Apple, Grapes", rate: "6.50", opening: "0.00", freight: "6000", labour: "1100" },
  { name: "Noor Agro Supplies", contact: "Noor Muhammad", phone: "0302-8877665", address: "Bahawalpur", items: "Banana, Watermelon", rate: "5.00", opening: "7500.00", freight: "4000", labour: "700" },
];

interface Produce {
  name: string;
  unit: string;
  qty: [number, number];
  rate: [number, number];
  months?: number[];
  decimals?: number;
  sizes?: string[];
}
const PRODUCE: Produce[] = [
  { name: "Tomato", unit: "crate", qty: [20, 120], rate: [800, 2200] },
  { name: "Onion", unit: "bag", qty: [30, 150], rate: [1800, 3500] },
  { name: "Potato", unit: "bag", qty: [30, 200], rate: [1500, 3000] },
  { name: "Garlic", unit: "kg", qty: [50, 300], rate: [300, 800], decimals: 1 },
  { name: "Ginger", unit: "kg", qty: [30, 200], rate: [250, 700], decimals: 1 },
  { name: "Lemon", unit: "kg", qty: [50, 400], rate: [80, 250], decimals: 1 },
  { name: "Green Chilli", unit: "kg", qty: [50, 300], rate: [60, 200], decimals: 1 },
  { name: "Cabbage", unit: "bag", qty: [20, 100], rate: [600, 1400], months: [1, 2, 3, 10, 11, 12] },
  { name: "Cauliflower", unit: "crate", qty: [20, 100], rate: [700, 1600], months: [1, 2, 3, 11, 12] },
  { name: "Apple", unit: "peti", qty: [10, 80], rate: [2500, 6000], months: [8, 9, 10, 11, 12, 1], sizes: ["48", "56", "64", "72"] },
  { name: "Banana", unit: "dozen", qty: [100, 600], rate: [60, 150] },
  { name: "Mango", unit: "crate", qty: [20, 100], rate: [1500, 4500], months: [5, 6, 7, 8], sizes: ["Large", "Medium", "Small"] },
  { name: "Orange", unit: "crate", qty: [20, 150], rate: [900, 2000], months: [11, 12, 1, 2, 3] },
  { name: "Kinnow", unit: "crate", qty: [20, 150], rate: [900, 2000], months: [11, 12, 1, 2, 3], sizes: ["A", "B", "C"] },
  { name: "Watermelon", unit: "piece", qty: [100, 800], rate: [80, 250], months: [4, 5, 6, 7, 8] },
  { name: "Grapes", unit: "crate", qty: [10, 60], rate: [1800, 4000], months: [7, 8, 9, 10] },
  { name: "Peach", unit: "crate", qty: [10, 60], rate: [1500, 3500], months: [6, 7, 8] },
];

const CUSTOMERS = [
  { name: "Sheikh Brothers", contact: "Sheikh Imran", phone: "0301-9990608", city: "Bahawalpur", opening: "0.00" },
  { name: "Ansari Fruit Merchants", contact: "Ansari Sahib", phone: "0301-8275367", city: "Kot Momin", opening: "128000.00" },
  { name: "Shakeel Khan", contact: null, phone: "0300-4412233", city: "Lahore", opening: "0.00" },
  { name: "Butt Fruit Merchants", contact: "Butt Sahib", phone: "0321-5566001", city: "Gujranwala", opening: "45000.00" },
  { name: "Saleem Jutt Fruit Co.", contact: "Saleem Jutt", phone: "0333-7788990", city: "Faisalabad", opening: "0.00" },
  { name: "Haris Ranjha Sabzi Mandi", contact: "Haris", phone: "0345-2211334", city: "Sheikhupura", opening: "-15000.00" },
  { name: "Rajput Wholesale", contact: "Rajput Sahib", phone: "0302-6655443", city: "Rawalpindi", opening: "0.00" },
  { name: "Dar Traders", contact: "Dar Sahib", phone: "0312-9900112", city: "Sialkot", opening: "22000.00" },
  { name: "Mughal Fruit House", contact: "Mughal Sahib", phone: "0334-8877001", city: "Lahore", opening: "0.00" },
  { name: "New Karachi Fruit Co.", contact: "Rizwan", phone: "0300-1122008", city: "Karachi", opening: "0.00" },
];
const SALE_ITEMS: { name: string; unit: string; qty: [number, number]; rate: [number, number]; months?: number[] }[] = [
  { name: "Kinnow", unit: "crate", qty: [20, 120], rate: [1200, 2800], months: [11, 12, 1, 2, 3] },
  { name: "Mango", unit: "crate", qty: [20, 115], rate: [2400, 3700], months: [5, 6, 7, 8] },
  { name: "Orange", unit: "crate", qty: [20, 100], rate: [1300, 2600], months: [11, 12, 1, 2, 3] },
  { name: "Apple", unit: "peti", qty: [10, 60], rate: [3000, 6500], months: [8, 9, 10, 11, 12, 1] },
  { name: "Banana", unit: "dozen", qty: [100, 500], rate: [90, 180] },
  { name: "Tomato", unit: "crate", qty: [20, 100], rate: [1000, 2600] },
  { name: "Potato", unit: "bag", qty: [30, 150], rate: [1800, 3400] },
  { name: "Onion", unit: "bag", qty: [30, 120], rate: [2000, 3900] },
  { name: "Market Goods", unit: "nag", qty: [5, 40], rate: [800, 2500] },
];

const PARTNERS = [
  { name: "Haji Sahib", share: "60.00", phone: "0300-0000001" },
  { name: "Chotay Bhai", share: "40.00", phone: "0300-0000002" },
];

const EXPENSE_PLAN: { category: ExpenseCategory; amount: [number, number]; perMonth: [number, number]; note: string[]; mode?: PaymentMode }[] = [
  { category: "RENT", amount: [45000, 45000], perMonth: [1, 1], note: ["Shop rent"], mode: "BANK" },
  { category: "ELECTRICITY", amount: [6000, 14000], perMonth: [1, 1], note: ["LESCO bill"], mode: "BANK" },
  { category: "WATER", amount: [800, 1500], perMonth: [1, 1], note: ["Water bill"] },
  { category: "SALARY", amount: [18000, 32000], perMonth: [2, 3], note: ["Munshi salary", "Helper salary", "Chowkidar"], mode: "CASH" },
  { category: "TEA_MEALS", amount: [250, 900], perMonth: [10, 18], note: ["Tea for staff & customers", "Lunch", "Chai paani"] },
  { category: "STAFF_FOOD", amount: [400, 1200], perMonth: [3, 8], note: ["Staff lunch", "Dinner for late unloading"] },
  { category: "TRANSPORT", amount: [500, 3500], perMonth: [2, 5], note: ["Rickshaw to bank", "Pickup hire"] },
  { category: "FUEL", amount: [1000, 4000], perMonth: [2, 4], note: ["Petrol – bike", "Diesel – pickup"] },
  { category: "MAINTENANCE", amount: [800, 9000], perMonth: [0, 2], note: ["Weighing scale repair", "Shutter repair", "Fan repair", "Whitewash"] },
  { category: "MOBILE_INTERNET", amount: [1500, 3000], perMonth: [1, 1], note: ["Mobile & internet package"], mode: "EASYPAISA" },
  { category: "STATIONERY_PACKING", amount: [300, 2500], perMonth: [1, 3], note: ["Bill books", "Polythene bags", "Markers & tape"] },
  { category: "COMMITTEE", amount: [20000, 20000], perMonth: [1, 1], note: ["Committee (BC) instalment"] },
  { category: "BANK_CHARGES", amount: [100, 600], perMonth: [0, 2], note: ["Bank charges"], mode: "BANK" },
  { category: "DONATION", amount: [500, 3000], perMonth: [0, 2], note: ["Masjid chanda", "Charity"] },
  { category: "MISCELLANEOUS", amount: [200, 2500], perMonth: [2, 5], note: ["Market union chanda", "Mobile top-up", "Small repairs"] },
];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function seedSuppliers(tx: Tx) {
  console.log("Inserting supplier parties…");
  const insertedParties = await tx
    .insert(parties)
    .values(
      PARTIES.map((p) => ({
        name: p.name,
        contactPerson: p.contact,
        phone: p.phone,
        address: p.address,
        mainItems: p.items,
        commissionRate: p.rate,
        openingBalance: p.opening,
        defaultFreight: money(Number(p.freight)),
        defaultLabour: money(Number(p.labour)),
        status: "ACTIVE" as const,
      })),
    )
    .returning({ id: parties.id, name: parties.name });

  let billCount = 0;
  let paidCount = 0;
  let txnCount = 0;

  for (const [index, party] of insertedParties.entries()) {
    const spec = PARTIES[index];
    for (let month = 1; month <= LAST_MONTH; month++) {
      const maxDay = month === LAST_MONTH ? Number(TODAY.slice(8, 10)) : daysInMonth(YEAR, month);
      const billsThisMonth = intBetween(2, 5);

      // Occasionally give the party an advance early in the month. Two parties receive a large
      // advance in the current month so the demo shows outstanding advances (receivables).
      const bigAdvance = month === LAST_MONTH && (index === 2 || index === 5);
      if (bigAdvance || chance(0.2)) {
        const advance = bigAdvance ? intBetween(1500, 2200) * 1000 : intBetween(10, 60) * 1000;
        await tx.insert(partyTransactions).values({
          partyId: party.id,
          txnDate: iso(YEAR, month, Math.min(maxDay, intBetween(1, 5))),
          type: "ADVANCE",
          debit: money(advance),
          credit: "0.00",
          paymentMode: chance(0.7) ? "CASH" : "BANK",
          description: "Advance given for upcoming gari",
        });
        txnCount++;
      }

      for (let b = 0; b < billsThisMonth; b++) {
        const day = intBetween(1, maxDay);
        const date = iso(YEAR, month, day);
        const inSeason = PRODUCE.filter((p) => !p.months || p.months.includes(month));
        const lineCount = intBetween(1, 4);
        const chosen = new Set<Produce>();
        while (chosen.size < lineCount) chosen.add(pick(inSeason));

        // Multi-size lots (apple / mango / kinnow) get one line per size with the same item name.
        const items = Array.from(chosen).flatMap((p) => {
          const sizes = p.sizes && chance(0.6) ? p.sizes.slice(0, intBetween(2, p.sizes.length)) : [null];
          return sizes.map((size) => ({
            itemName: p.name,
            size,
            quantity: p.decimals ? between(p.qty[0], p.qty[1]).toFixed(p.decimals) : String(intBetween(p.qty[0], p.qty[1])),
            unit: p.unit,
            rate: String(intBetween(p.rate[0], p.rate[1])),
          }));
        });

        // Scale expenses down for small lots so they never exceed ~12% of the sale value.
        const grossEstimate = items.reduce((acc, it) => acc + Number(it.quantity) * Number(it.rate), 0);
        const expenseScale = Math.min(1, (grossEstimate * 0.12) / (Number(spec.freight) + Number(spec.labour) + 2500));
        const calc = calculateBill({
          items,
          commissionPct: spec.rate,
          freight: String(Math.round(Number(spec.freight) * between(0.8, 1.3) * expenseScale)),
          labour: String(Math.round(Number(spec.labour) * between(0.8, 1.4) * expenseScale)),
          marketFee: String(Math.round(intBetween(100, 500) * expenseScale)),
          munshiyana: chance(0.7) ? String(Math.round(intBetween(100, 300) * expenseScale)) : "0",
          otherExpense: chance(0.15) ? String(Math.round(intBetween(200, 1500) * expenseScale)) : "0",
          advanceAdjusted: "0",
        });

        // Bills older than ~10 days are almost always settled; recent ones stay pending.
        const ageDays = (LAST_MONTH - month) * 30 + (Number(TODAY.slice(8, 10)) - day);
        const paid = ageDays > 10 && chance(0.97);
        const gari = `${pick(["LES", "LEB", "MNA", "FSD", "RWP", "SGD"])}-${intBetween(1000, 9999)}`;

        const [bill] = await tx
          .insert(bills)
          .values({
            partyId: party.id,
            billDate: date,
            gariNumber: gari,
            grossAmount: calc.grossAmount,
            commissionPct: calc.commissionPct,
            commissionAmount: calc.commissionAmount,
            freight: calc.freight,
            labour: calc.labour,
            marketFee: calc.marketFee,
            munshiyana: calc.munshiyana,
            otherExpense: calc.otherExpense,
            otherExpenseNote: D(calc.otherExpense).isZero() ? null : pick(["Ice", "Repacking", "Extra loading"]),
            totalExpenses: calc.totalExpenses,
            netAmount: calc.netAmount,
            advanceAdjusted: calc.advanceAdjusted,
            finalPayable: calc.finalPayable,
            status: paid ? "PAID" : "PENDING",
          })
          .returning({ id: bills.id });

        await tx.insert(billItems).values(
          calc.items.map((item, i) => ({
            billId: bill.id,
            lineNo: i + 1,
            itemName: item.itemName,
            size: item.size,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            amount: item.amount,
          })),
        );

        const itemNames = Array.from(new Set(calc.items.map((i) => i.itemName)));
        const ledger: (typeof partyTransactions.$inferInsert)[] = [
          {
            partyId: party.id,
            txnDate: date,
            type: "BILL",
            credit: calc.netAmount,
            debit: "0.00",
            referenceId: bill.id,
            description: `Patti ${billNumber(bill.id)} · Gari ${gari} · ${itemNames.join(", ")}`,
          },
        ];
        if (paid) {
          ledger.push({
            partyId: party.id,
            txnDate: addDays(date, intBetween(0, 6)),
            type: "PAYMENT",
            credit: "0.00",
            debit: calc.finalPayable,
            referenceId: bill.id,
            paymentMode: pick(MODES),
            description: `Payment for patti ${billNumber(bill.id)}`,
          });
          paidCount++;
        }
        await tx.insert(partyTransactions).values(ledger);
        txnCount += ledger.length;
        billCount++;
      }
    }
  }
  console.log(`  ${insertedParties.length} parties, ${billCount} bills (${paidCount} paid), ${txnCount} ledger entries.`);
}

async function seedCustomers(tx: Tx) {
  console.log("Inserting customers and khata entries…");
  const inserted = await tx
    .insert(customers)
    .values(
      CUSTOMERS.map((c) => ({
        name: c.name,
        contactPerson: c.contact,
        phone: c.phone,
        city: c.city,
        openingBalance: c.opening,
        status: "ACTIVE" as const,
      })),
    )
    .returning({ id: customers.id });

  const rows: (typeof saleEntries.$inferInsert)[] = [];
  let billNo = 1001;
  for (const [index, customer] of inserted.entries()) {
    // Running due so receipts stay realistic (customers pay most of what they owe).
    let due = Number(CUSTOMERS[index].opening);
    for (let month = 1; month <= LAST_MONTH; month++) {
      const maxDay = month === LAST_MONTH ? Number(TODAY.slice(8, 10)) : daysInMonth(YEAR, month);
      const entriesThisMonth = intBetween(2, 5);
      for (let e = 0; e < entriesThisMonth; e++) {
        const day = intBetween(1, maxDay);
        const date = iso(YEAR, month, day);
        const inSeason = SALE_ITEMS.filter((i) => !i.months || i.months.includes(month));
        const roll = rand();
        if (roll < 0.25 && due > 0) {
          // payment-only row
          const received = Math.round((due * between(0.3, 1)) / 100) * 100;
          if (received <= 0) continue;
          const calc = calculateSaleEntry({ quantity: null, rate: null, received: String(received) });
          rows.push({
            customerId: customer.id,
            entryDate: date,
            amount: calc.amount,
            received: calc.received,
            paymentMode: pick(MODES),
            reference: chance(0.5) ? `Rcpt ${intBetween(100, 999)}` : null,
            remarks: chance(0.3) ? "Against old balance" : null,
          });
          due -= received;
        } else {
          const item = pick(inSeason);
          const qty = String(intBetween(item.qty[0], item.qty[1]));
          const rate = String(intBetween(item.rate[0], item.rate[1]));
          // Most goods rows also carry a (partial or full) payment, like the Khaata sheet rows.
          const amount = Number(qty) * Number(rate);
          const payNow = chance(0.65) ? Math.round((amount * between(0.5, 1)) / 100) * 100 : 0;
          const calc = calculateSaleEntry({ quantity: qty, rate, received: String(payNow) });
          rows.push({
            customerId: customer.id,
            entryDate: date,
            itemName: item.name,
            quantity: calc.quantity,
            unit: item.unit,
            rate: calc.rate,
            amount: calc.amount,
            received: calc.received,
            paymentMode: payNow > 0 ? pick(MODES) : null,
            reference: `Bill ${billNo++}`,
            remarks: null,
          });
          due += amount - payNow;
        }
      }
    }
  }
  rows.sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0));
  for (let i = 0; i < rows.length; i += 100) {
    await tx.insert(saleEntries).values(rows.slice(i, i + 100));
  }
  console.log(`  ${inserted.length} customers, ${rows.length} khata entries.`);
}

async function seedExpenses(tx: Tx) {
  console.log("Inserting shop expenses…");
  const expenseRows: (typeof shopExpenses.$inferInsert)[] = [];
  for (let month = 1; month <= LAST_MONTH; month++) {
    const maxDay = month === LAST_MONTH ? Number(TODAY.slice(8, 10)) : daysInMonth(YEAR, month);
    for (const plan of EXPENSE_PLAN) {
      const n = intBetween(plan.perMonth[0], plan.perMonth[1]);
      for (let i = 0; i < n; i++) {
        const day =
          plan.category === "RENT" || plan.category === "COMMITTEE"
            ? 1
            : plan.category === "SALARY"
              ? Math.min(maxDay, daysInMonth(YEAR, month))
              : intBetween(1, maxDay);
        if (day > maxDay) continue;
        expenseRows.push({
          expenseDate: iso(YEAR, month, day),
          category: plan.category,
          amount: money(Math.round(between(plan.amount[0], plan.amount[1]) / 10) * 10),
          paymentMode: plan.mode ?? (chance(0.85) ? "CASH" : "BANK"),
          notes: plan.note[i % plan.note.length],
        });
      }
    }
  }
  for (let i = 0; i < expenseRows.length; i += 100) {
    await tx.insert(shopExpenses).values(expenseRows.slice(i, i + 100));
  }
  console.log(`  ${expenseRows.length} expenses.`);
}

/** Creates the partners and assigns "paid by" to expenses that have none yet (≈ 60/40 like their shares, some from the cash box). */
async function seedPartners(tx: Tx) {
  console.log("Inserting partners…");
  const inserted = await tx
    .insert(partners)
    .values(PARTNERS.map((p) => ({ name: p.name, sharePct: p.share, phone: p.phone, status: "ACTIVE" as const })))
    .returning({ id: partners.id });
  const unassigned = await tx.select({ id: shopExpenses.id }).from(shopExpenses).where(isNull(shopExpenses.paidByPartnerId));
  let assigned = 0;
  for (const row of unassigned) {
    const roll = rand();
    const partnerId = roll < 0.45 ? inserted[0].id : roll < 0.8 ? inserted[1].id : null;
    if (partnerId === null) continue;
    await tx.update(shopExpenses).set({ paidByPartnerId: partnerId }).where(eq(shopExpenses.id, row.id));
    assigned++;
  }
  console.log(`  ${inserted.length} partners; paid-by set on ${assigned} of ${unassigned.length} expenses.`);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const resetCustomers = args.includes("--reset-customers");
  const resetPartners = args.includes("--reset-partners");

  await db.transaction(async (tx) => {
    if (force) {
      console.log("Wiping ALL data…");
      await tx.execute(
        sql`TRUNCATE TABLE bill_items, party_transactions, bills, sale_entries, customers, shop_expenses, partners, parties RESTART IDENTITY CASCADE`,
      );
    }
    if (resetCustomers && !force) {
      console.log("Wiping customers and khata entries…");
      await tx.execute(sql`TRUNCATE TABLE sale_entries, customers RESTART IDENTITY CASCADE`);
    }
    if (resetPartners && !force) {
      console.log("Wiping partners…");
      await tx.execute(sql`UPDATE shop_expenses SET paid_by_partner_id = NULL`);
      await tx.execute(sql`TRUNCATE TABLE partners RESTART IDENTITY CASCADE`);
    }

    const counts = {
      parties: Number((await tx.select({ n: sql<number>`count(*)::int` }).from(parties))[0].n),
      customers: Number((await tx.select({ n: sql<number>`count(*)::int` }).from(customers))[0].n),
      expenses: Number((await tx.select({ n: sql<number>`count(*)::int` }).from(shopExpenses))[0].n),
      partners: Number((await tx.select({ n: sql<number>`count(*)::int` }).from(partners))[0].n),
    };

    let did = false;
    if (counts.parties === 0) {
      await seedSuppliers(tx);
      did = true;
    } else console.log(`Suppliers: ${counts.parties} parties already present – skipped.`);
    if (counts.customers === 0) {
      await seedCustomers(tx);
      did = true;
    } else console.log(`Customers: ${counts.customers} customers already present – skipped.`);
    if (counts.expenses === 0) {
      await seedExpenses(tx);
      did = true;
    } else console.log(`Expenses: ${counts.expenses} entries already present – skipped.`);
    if (counts.partners === 0) {
      await seedPartners(tx);
      did = true;
    } else console.log(`Partners: ${counts.partners} already present – skipped.`);

    if (!did) console.log("Nothing to seed. Use --force to wipe and re-seed everything.");
  });

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
