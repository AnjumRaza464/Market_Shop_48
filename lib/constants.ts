import type { BillStatus, ExpenseCategory, PaymentMode, TransactionType } from "@/db/schema";

export const SHOP = {
  name: process.env.NEXT_PUBLIC_SHOP_NAME?.trim() || "Market 48 Shop",
  address: process.env.NEXT_PUBLIC_SHOP_ADDRESS?.trim() || "",
  phone: process.env.NEXT_PUBLIC_SHOP_PHONE?.trim() || "",
};

/** Display order of expense categories (the DB enum order is historical / append-only). */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "RENT", label: "Shop rent" },
  { value: "ELECTRICITY", label: "Electricity bill" },
  { value: "WATER", label: "Water bill" },
  { value: "TEA_MEALS", label: "Tea & snacks" },
  { value: "STAFF_FOOD", label: "Staff food / lunch" },
  { value: "SALARY", label: "Staff salary" },
  { value: "TRANSPORT", label: "Transport & freight" },
  { value: "FUEL", label: "Fuel / petrol" },
  { value: "MAINTENANCE", label: "Repair & maintenance" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "MOBILE_INTERNET", label: "Mobile & internet" },
  { value: "STATIONERY_PACKING", label: "Stationery & packing" },
  { value: "EQUIPMENT", label: "Equipment & tools" },
  { value: "COMMITTEE", label: "Committee (BC)" },
  { value: "LOAN_INTEREST", label: "Loan instalment / interest" },
  { value: "BANK_CHARGES", label: "Bank charges" },
  { value: "TAXES_FEES", label: "Taxes & market fees" },
  { value: "LICENCE_FEES", label: "Licence & fees" },
  { value: "ADVERTISING", label: "Advertising" },
  { value: "HOSPITALITY", label: "Guest hospitality" },
  { value: "DONATION", label: "Donation / charity" },
  { value: "FESTIVAL", label: "Festival expenses" },
  { value: "MEDICAL", label: "Medical" },
  { value: "MISCELLANEOUS", label: "Miscellaneous / other" },
];
export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value) as [
  ExpenseCategory,
  ...ExpenseCategory[],
];

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank transfer" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
];
export const PAYMENT_MODE_VALUES = PAYMENT_MODES.map((m) => m.value) as [PaymentMode, ...PaymentMode[]];

export function paymentModeLabel(value: PaymentMode | null | undefined): string {
  return labelFor(PAYMENT_MODES, value);
}

export const TRANSACTION_TYPES: { value: TransactionType; label: string; hint: string }[] = [
  { value: "BILL", label: "Bill (Patti)", hint: "Net amount of a settled lot – credited to the party" },
  { value: "PAYMENT", label: "Payment to party", hint: "Cash / bank paid to the party against dues" },
  { value: "ADVANCE", label: "Advance to party", hint: "Money given before goods arrive – party owes the shop" },
  { value: "RECEIPT", label: "Received from party", hint: "Money received from the party (e.g. advance returned)" },
  { value: "ADJUSTMENT", label: "Adjustment", hint: "Manual correction, discount or write-off" },
];
export const MANUAL_TRANSACTION_TYPES = TRANSACTION_TYPES.filter((t) => t.value !== "BILL");

export const BILL_STATUSES: { value: BillStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Customer khata position (sign of the customer balance). */
export type CustomerPosition = "DUE" | "ADVANCE" | "CLEAR";
export const CUSTOMER_POSITIONS: { value: CustomerPosition; label: string }[] = [
  { value: "DUE", label: "Due (owes us)" },
  { value: "ADVANCE", label: "Advance (paid ahead)" },
  { value: "CLEAR", label: "Clear" },
];

export const UNITS = ["kg", "maund", "crate", "peti", "box", "bag", "bori", "piece", "dozen", "bundle", "nag", "ton"];

export const COMMON_ITEMS = [
  "Tomato",
  "Onion",
  "Potato",
  "Garlic",
  "Ginger",
  "Lemon",
  "Green Chilli",
  "Capsicum",
  "Cucumber",
  "Cabbage",
  "Cauliflower",
  "Carrot",
  "Peas",
  "Spinach",
  "Okra",
  "Brinjal",
  "Bottle Gourd",
  "Pumpkin",
  "Apple",
  "Banana",
  "Mango",
  "Orange",
  "Kinnow",
  "Grapes",
  "Pomegranate",
  "Guava",
  "Watermelon",
  "Melon",
  "Papaya",
  "Dates",
  "Peach",
  "Plum",
  "Apricot",
  "Pear",
  "Kiwi",
  "Market Goods",
];

export function labelFor<T extends string>(list: { value: T; label: string }[], value: T | null | undefined): string {
  return list.find((x) => x.value === value)?.label ?? (value ?? "—");
}

export const PAGE_SIZE = 50;
