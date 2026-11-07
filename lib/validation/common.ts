import { z } from "zod";
import { D } from "@/lib/money";
import { isValidISODate } from "@/lib/dates";

const stripCommas = (s: string) => s.replace(/,/g, "").trim();

/** Non-negative amount, up to 2 decimals. Empty input becomes "0". */
export const zMoneyOptional = z
  .string()
  .transform((s) => stripCommas(s) || "0")
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount (max 2 decimals)"));

/** Non-negative amount, required (may be 0). */
export const zMoney = z
  .string()
  .transform(stripCommas)
  .pipe(z.string().min(1, "Amount is required").regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount (max 2 decimals)"));

/** Amount strictly greater than zero. */
export const zPositiveMoney = zMoney.refine((v) => D(v).greaterThan(0), "Amount must be greater than 0");

/** Quantity strictly greater than zero, up to 3 decimals. */
export const zQty = z
  .string()
  .transform(stripCommas)
  .pipe(z.string().min(1, "Quantity is required").regex(/^\d{1,9}(\.\d{1,3})?$/, "Enter a valid quantity (max 3 decimals)"))
  .refine((v) => D(v).greaterThan(0), "Quantity must be greater than 0");

/** Percentage 0–100, up to 2 decimals. */
export const zPct = z
  .string()
  .transform(stripCommas)
  .pipe(z.string().min(1, "Commission % is required").regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a valid percentage"))
  .refine((v) => D(v).lessThanOrEqualTo(100), "Percentage cannot exceed 100");

export const zISODate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD")
  .refine(isValidISODate, "Enter a valid date");

export const zId = z.coerce.number().int().positive("Select a valid record");

/** Optional positive integer id (e.g. a <select> with an empty "none" option). Empty → null. */
export const zIdNullable = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : NaN;
  })
  .refine((v) => v === null || !Number.isNaN(v), "Select a valid record");

/** Optional non-negative amount: empty input becomes null, otherwise a validated 2-dp string. */
export const zMoneyNullable = z
  .string()
  .optional()
  .transform((s) => stripCommas(s ?? ""))
  .pipe(z.string().regex(/^$|^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount (max 2 decimals)"))
  .transform((s) => (s.length ? s : null));

/** Optional quantity (> 0 when given, up to 3 decimals): empty input becomes null. */
export const zQtyNullable = z
  .string()
  .optional()
  .transform((s) => stripCommas(s ?? ""))
  .pipe(z.string().regex(/^$|^\d{1,9}(\.\d{1,3})?$/, "Enter a valid quantity (max 3 decimals)"))
  .transform((s) => (s.length ? s : null))
  .refine((v) => v === null || D(v).greaterThan(0), "Quantity must be greater than 0");

/** Optional free text: trims, enforces a max length, and stores empty strings as null. */
export const zOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((s) => (s.length ? s : null));

export type FieldErrors = Record<string, string>;

/** Flatten Zod issues to a { "items.0.rate": "message" } map (first message per path wins). */
export function issuesToFieldErrors(issues: z.core.$ZodIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Convert FormData into a nested plain object.
 *   "items[0][itemName]" → { items: [{ itemName }] }
 *   "party.name"         → { party: { name } }
 * Sparse array slots (from removed rows) are compacted.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [rawKey, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (rawKey.startsWith("$ACTION")) continue;
    const path = rawKey.replace(/\]/g, "").split(/\[|\./).filter(Boolean);
    let cursor: Record<string, unknown> | unknown[] = root;
    path.forEach((segment, index) => {
      const isLast = index === path.length - 1;
      const nextIsIndex = !isLast && /^\d+$/.test(path[index + 1]);
      const key: string | number = Array.isArray(cursor) ? Number(segment) : segment;
      if (isLast) {
        (cursor as Record<string | number, unknown>)[key] = value;
        return;
      }
      const container = cursor as Record<string | number, unknown>;
      if (container[key] === undefined) container[key] = nextIsIndex ? [] : {};
      cursor = container[key] as Record<string, unknown> | unknown[];
    });
  }
  return compactArrays(root) as Record<string, unknown>;
}

function compactArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined).map(compactArrays);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = compactArrays(v);
    return out;
  }
  return value;
}
