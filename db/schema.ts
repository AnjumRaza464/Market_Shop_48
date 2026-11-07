/**
 * Market 48 Shop – database schema (Neon PostgreSQL via Drizzle ORM).
 *
 * Money columns are NUMERIC(14,2) and are read/written as *strings*. All arithmetic
 * happens in `lib/money.ts` with decimal.js so no floating-point error can creep in.
 *
 * Two kinds of parties are tracked in separate khatas:
 *
 *  1. SUPPLIER parties (`parties`) – beoparis / farmers whose goods the shop sells on
 *     commission. Ledger = `party_transactions`.
 *       credit  = the shop owes the party more   (e.g. a bill's net amount)
 *       debit   = the party owes the shop more   (e.g. cash paid / advance given to the party)
 *       balance = opening_balance + Σcredit − Σdebit
 *       balance > 0 → payable to the party;  balance < 0 → receivable (advance outstanding)
 *
 *  2. CUSTOMER parties (`customers`) – buyers to whom the shop supplies goods on udhaar.
 *     Ledger = `sale_entries` (one row per goods line and/or cash receipt, like the Khaata sheet).
 *       debit   (amount)   = goods given – the customer owes the shop more
 *       credit  (received) = cash received from the customer
 *       balance = opening_balance + Σamount − Σreceived
 *       balance > 0 → due from the customer;  balance < 0 → customer has paid in advance
 */
import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const partyStatusEnum = pgEnum("party_status", ["ACTIVE", "INACTIVE"]);
export const billStatusEnum = pgEnum("bill_status", ["PENDING", "PAID", "CANCELLED"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "BILL", // credit: net amount of a settled lot (patti)
  "PAYMENT", // debit: cash/bank paid to the party against dues
  "ADVANCE", // debit: advance money given to the party before goods arrive
  "RECEIPT", // credit: money received from the party (e.g. advance returned)
  "ADJUSTMENT", // either side: manual correction / discount / write-off
]);
/** New values are appended (never reordered) so migrations stay additive. */
export const paymentModeEnum = pgEnum("payment_mode", ["CASH", "BANK", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "RENT",
  "ELECTRICITY",
  "TEA_MEALS",
  "SALARY",
  "MAINTENANCE",
  "TRANSPORT",
  "MISCELLANEOUS",
  // appended – mirror the categories of the shop expense sheet
  "WATER",
  "STAFF_FOOD",
  "FUEL",
  "CLEANING",
  "MOBILE_INTERNET",
  "STATIONERY_PACKING",
  "DONATION",
  "COMMITTEE",
  "BANK_CHARGES",
  "LOAN_INTEREST",
  "TAXES_FEES",
  "LICENCE_FEES",
  "ADVERTISING",
  "HOSPITALITY",
  "EQUIPMENT",
  "MEDICAL",
  "FESTIVAL",
]);

// ---------- Helpers ----------
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------- Supplier side ----------
export const parties = pgTable(
  "parties",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 120 }).notNull(),
    contactPerson: varchar("contact_person", { length: 120 }),
    phone: varchar("phone", { length: 30 }),
    /** Market / mandi / city of the party. */
    address: text("address"),
    /** Main items this party usually sends (free text, e.g. "Apple, Pomegranate"). */
    mainItems: varchar("main_items", { length: 200 }),
    /** Default commission percentage deducted from this party's bills (e.g. 5.00, 6.00). */
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("6.00"),
    /** Signed. Positive = shop owes party (Cr), negative = party owes shop (Dr). */
    openingBalance: money("opening_balance").notNull().default("0.00"),
    /** Default freight (kiraya) pre-filled on new bills. */
    defaultFreight: money("default_freight").notNull().default("0.00"),
    /** Default labour (mazdoori) pre-filled on new bills. */
    defaultLabour: money("default_labour").notNull().default("0.00"),
    notes: text("notes"),
    status: partyStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [
    index("parties_name_idx").on(t.name),
    index("parties_status_idx").on(t.status),
    check("parties_commission_rate_range", sql`${t.commissionRate} >= 0 AND ${t.commissionRate} <= 100`),
  ],
);

export const bills = pgTable(
  "bills",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    billDate: date("bill_date", { mode: "string" }).notNull(),
    gariNumber: varchar("gari_number", { length: 50 }),
    /** Sum of (item quantity × rate). */
    grossAmount: money("gross_amount").notNull().default("0.00"),
    commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }).notNull(),
    commissionAmount: money("commission_amount").notNull().default("0.00"),
    freight: money("freight").notNull().default("0.00"), // kiraya
    labour: money("labour").notNull().default("0.00"), // mazdoori
    marketFee: money("market_fee").notNull().default("0.00"),
    munshiyana: money("munshiyana").notNull().default("0.00"),
    otherExpense: money("other_expense").notNull().default("0.00"),
    otherExpenseNote: varchar("other_expense_note", { length: 120 }),
    /** freight + labour + market_fee + munshiyana + other_expense */
    totalExpenses: money("total_expenses").notNull().default("0.00"),
    /** gross − commission − total_expenses → credited to the party ledger */
    netAmount: money("net_amount").notNull().default("0.00"),
    /** Part of an earlier advance recovered through this bill (informational on the patti). */
    advanceAdjusted: money("advance_adjusted").notNull().default("0.00"),
    /** net_amount − advance_adjusted → cash actually payable now */
    finalPayable: money("final_payable").notNull().default("0.00"),
    notes: text("notes"),
    status: billStatusEnum("status").notNull().default("PENDING"),
    ...timestamps,
  },
  (t) => [
    index("bills_party_id_idx").on(t.partyId),
    index("bills_bill_date_idx").on(t.billDate),
    index("bills_status_idx").on(t.status),
    check("bills_commission_pct_range", sql`${t.commissionPct} >= 0 AND ${t.commissionPct} <= 100`),
    check("bills_gross_nonneg", sql`${t.grossAmount} >= 0`),
  ],
);

export const billItems = pgTable(
  "bill_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    itemName: varchar("item_name", { length: 120 }).notNull(),
    /** Size / count (dana) of the lot, e.g. "48", "Large" – one line per size on a multi-size gari. */
    size: varchar("size", { length: 40 }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull().default("kg"),
    rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
    /** quantity × rate, rounded half-up to 2 dp */
    amount: money("amount").notNull(),
  },
  (t) => [
    index("bill_items_bill_id_idx").on(t.billId),
    check("bill_items_quantity_positive", sql`${t.quantity} > 0`),
    check("bill_items_rate_nonneg", sql`${t.rate} >= 0`),
  ],
);

export const partyTransactions = pgTable(
  "party_transactions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    txnDate: date("txn_date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    debit: money("debit").notNull().default("0.00"),
    credit: money("credit").notNull().default("0.00"),
    description: text("description"),
    /** The bill this entry belongs to (BILL credit / PAYMENT against a bill). */
    referenceId: integer("reference_id").references(() => bills.id, { onDelete: "cascade" }),
    paymentMode: paymentModeEnum("payment_mode"),
    ...timestamps,
  },
  (t) => [
    index("party_transactions_party_date_idx").on(t.partyId, t.txnDate),
    index("party_transactions_reference_idx").on(t.referenceId),
    index("party_transactions_type_idx").on(t.type),
    check("party_transactions_debit_nonneg", sql`${t.debit} >= 0`),
    check("party_transactions_credit_nonneg", sql`${t.credit} >= 0`),
  ],
);

// ---------- Customer side (goods supplied on udhaar) ----------
export const customers = pgTable(
  "customers",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 120 }).notNull(),
    contactPerson: varchar("contact_person", { length: 120 }),
    phone: varchar("phone", { length: 30 }),
    /** Mandi / city of the customer. */
    city: varchar("city", { length: 120 }),
    address: text("address"),
    /** Signed. Positive = customer owes the shop (old dues), negative = customer paid in advance. */
    openingBalance: money("opening_balance").notNull().default("0.00"),
    notes: text("notes"),
    status: partyStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [index("customers_name_idx").on(t.name), index("customers_status_idx").on(t.status)],
);

export const saleEntries = pgTable(
  "sale_entries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    /** Goods line (all nullable – a receipt-only row leaves them empty). */
    itemName: varchar("item_name", { length: 120 }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }),
    unit: varchar("unit", { length: 20 }),
    rate: numeric("rate", { precision: 12, scale: 2 }),
    /** Goods amount = quantity × rate (debit – customer owes more). */
    amount: money("amount").notNull().default("0.00"),
    /** Cash / bank received from the customer (credit). */
    received: money("received").notNull().default("0.00"),
    paymentMode: paymentModeEnum("payment_mode"),
    /** Bill / receipt number or any reference. */
    reference: varchar("reference", { length: 50 }),
    remarks: text("remarks"),
    ...timestamps,
  },
  (t) => [
    index("sale_entries_customer_date_idx").on(t.customerId, t.entryDate),
    index("sale_entries_date_idx").on(t.entryDate),
    index("sale_entries_item_idx").on(t.itemName),
    check("sale_entries_amount_nonneg", sql`${t.amount} >= 0`),
    check("sale_entries_received_nonneg", sql`${t.received} >= 0`),
    check("sale_entries_not_empty", sql`${t.amount} > 0 OR ${t.received} > 0`),
  ],
);

// ---------- Shop ----------
/** Partners who share the shop's expenses (used for "paid by" and settlement). */
export const partners = pgTable(
  "partners",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 120 }).notNull(),
    /** Share of shop expenses this partner should bear, in percent. All active partners should sum to 100. */
    sharePct: numeric("share_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
    phone: varchar("phone", { length: 30 }),
    notes: text("notes"),
    status: partyStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [check("partners_share_pct_range", sql`${t.sharePct} >= 0 AND ${t.sharePct} <= 100`)],
);

export const shopExpenses = pgTable(
  "shop_expenses",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    category: expenseCategoryEnum("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMode: paymentModeEnum("payment_mode").notNull().default("CASH"),
    /** Partner who paid from their own pocket; null = paid from the shop cash box. */
    paidByPartnerId: integer("paid_by_partner_id").references(() => partners.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("shop_expenses_date_idx").on(t.expenseDate),
    index("shop_expenses_category_idx").on(t.category),
    index("shop_expenses_partner_idx").on(t.paidByPartnerId),
    check("shop_expenses_amount_positive", sql`${t.amount} > 0`),
  ],
);

// ---------- Relations ----------
export const partiesRelations = relations(parties, ({ many }) => ({
  bills: many(bills),
  transactions: many(partyTransactions),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  party: one(parties, { fields: [bills.partyId], references: [parties.id] }),
  items: many(billItems),
  transactions: many(partyTransactions),
}));

export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(bills, { fields: [billItems.billId], references: [bills.id] }),
}));

export const partyTransactionsRelations = relations(partyTransactions, ({ one }) => ({
  party: one(parties, { fields: [partyTransactions.partyId], references: [parties.id] }),
  bill: one(bills, { fields: [partyTransactions.referenceId], references: [bills.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  entries: many(saleEntries),
}));

export const saleEntriesRelations = relations(saleEntries, ({ one }) => ({
  customer: one(customers, { fields: [saleEntries.customerId], references: [customers.id] }),
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  expenses: many(shopExpenses),
}));

export const shopExpensesRelations = relations(shopExpenses, ({ one }) => ({
  paidBy: one(partners, { fields: [shopExpenses.paidByPartnerId], references: [partners.id] }),
}));

// ---------- Types ----------
export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillItem = typeof billItems.$inferSelect;
export type NewBillItem = typeof billItems.$inferInsert;
export type PartyTransaction = typeof partyTransactions.$inferSelect;
export type NewPartyTransaction = typeof partyTransactions.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type SaleEntry = typeof saleEntries.$inferSelect;
export type NewSaleEntry = typeof saleEntries.$inferInsert;
export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type ShopExpense = typeof shopExpenses.$inferSelect;
export type NewShopExpense = typeof shopExpenses.$inferInsert;

export type PartyStatus = (typeof partyStatusEnum.enumValues)[number];
export type BillStatus = (typeof billStatusEnum.enumValues)[number];
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type PaymentMode = (typeof paymentModeEnum.enumValues)[number];
export type ExpenseCategory = (typeof expenseCategoryEnum.enumValues)[number];
