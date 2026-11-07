/**
 * Exact money arithmetic. Every amount that touches the database is a decimal *string*;
 * every calculation goes through decimal.js so 0.1 + 0.2 is never 0.30000000000000004.
 */
import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Numeric = string | number | Decimal | null | undefined;

export const ZERO = new Decimal(0);

/** Coerce any supported input into a Decimal. Empty / invalid input becomes 0. */
export function D(value: Numeric): Decimal {
  if (value === null || value === undefined) return ZERO;
  if (value instanceof Decimal) return value;
  if (typeof value === "number") return Number.isFinite(value) ? new Decimal(value) : ZERO;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return ZERO;
  try {
    return new Decimal(cleaned);
  } catch {
    return ZERO;
  }
}

/** Round half-up to 2 decimal places (paisa). */
export function round2(value: Numeric): Decimal {
  return D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Canonical DB representation of a money value: "12345.60". */
export function toMoneyString(value: Numeric): string {
  return round2(value).toFixed(2);
}

/** Canonical DB representation of a quantity: "12.500". */
export function toQtyString(value: Numeric): string {
  return D(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
}

/** Canonical DB representation of a percentage: "6.00". */
export function toPctString(value: Numeric): string {
  return D(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function sum(values: Iterable<Numeric>): Decimal {
  let total = ZERO;
  for (const v of values) total = total.plus(D(v));
  return total;
}

export function isZero(value: Numeric): boolean {
  return D(value).isZero();
}

export function isNegative(value: Numeric): boolean {
  return D(value).isNegative() && !D(value).isZero();
}

export function isPositive(value: Numeric): boolean {
  return D(value).greaterThan(0);
}

export const CURRENCY_SYMBOL = (process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "").trim() || "Rs";

// en-IN grouping (12,34,567.00) is the convention in South Asian markets.
const amountFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const qtyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
const pctFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "1,23,456.00" – no symbol. Negative values keep a leading minus. */
export function formatAmount(value: Numeric): string {
  const d = round2(value);
  const formatted = amountFormatter.format(Number(d.abs().toFixed(2)));
  return d.isNegative() && !d.isZero() ? `-${formatted}` : formatted;
}

/** "Rs 1,23,456.00". With `signed`, positive values get an explicit "+". */
export function formatMoney(value: Numeric, options?: { signed?: boolean; symbol?: boolean }): string {
  const d = round2(value);
  const body = amountFormatter.format(Number(d.abs().toFixed(2)));
  const symbol = options?.symbol === false ? "" : `${CURRENCY_SYMBOL} `;
  if (d.isNegative() && !d.isZero()) return `-${symbol}${body}`;
  if (options?.signed && d.greaterThan(0)) return `+${symbol}${body}`;
  return `${symbol}${body}`;
}

/** Quantities: "12.5", "1,250", "0.125". */
export function formatQty(value: Numeric): string {
  return qtyFormatter.format(Number(D(value).toDecimalPlaces(3).toFixed(3)));
}

/** "6%", "5.5%". */
export function formatPct(value: Numeric): string {
  return `${pctFormatter.format(Number(D(value).toDecimalPlaces(2).toFixed(2)))}%`;
}

/** Compact axis labels in the Indian system: 850, 12K, 3.4L, 1.2Cr. */
export function formatCompact(value: Numeric): string {
  const d = D(value);
  const abs = d.abs();
  const sign = d.isNegative() && !d.isZero() ? "-" : "";
  const fmt = (n: Decimal) => {
    const s = n.toDecimalPlaces(1).toString();
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  if (abs.greaterThanOrEqualTo(10_000_000)) return `${sign}${fmt(abs.dividedBy(10_000_000))}Cr`;
  if (abs.greaterThanOrEqualTo(100_000)) return `${sign}${fmt(abs.dividedBy(100_000))}L`;
  if (abs.greaterThanOrEqualTo(1_000)) return `${sign}${fmt(abs.dividedBy(1_000))}K`;
  return `${sign}${fmt(abs)}`;
}

/** Strip a user-typed amount down to a clean string for inputs (keeps digits, one dot, leading minus). */
export function sanitizeDecimalInput(raw: string, options?: { allowNegative?: boolean; scale?: number }): string {
  const scale = options?.scale ?? 2;
  let s = raw.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const negative = options?.allowNegative && s.startsWith("-");
  s = s.replace(/-/g, "");
  const [intPart, ...rest] = s.split(".");
  let out = intPart;
  if (rest.length > 0) out += `.${rest.join("").slice(0, scale)}`;
  return negative ? `-${out}` : out;
}
