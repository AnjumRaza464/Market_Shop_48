/**
 * Date helpers. The app stores calendar dates as ISO "YYYY-MM-DD" strings (PostgreSQL DATE),
 * so none of these functions depend on the server's local time zone.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Karachi";

/** First and last report years shown in the year pickers. */
export const REPORT_YEAR_START = 2025;
export const REPORT_YEAR_END = 2035;
export const REPORT_YEARS: number[] = Array.from(
  { length: REPORT_YEAR_END - REPORT_YEAR_START + 1 },
  (_, i) => REPORT_YEAR_START + i,
);

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's date in the shop's time zone (server only). */
export function todayISO(timeZone: string = APP_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentYear(timeZone: string = APP_TIMEZONE): number {
  return Number(todayISO(timeZone).slice(0, 4));
}

export function currentMonth(timeZone: string = APP_TIMEZONE): number {
  return Number(todayISO(timeZone).slice(5, 7));
}

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "08 Nov 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso || !isValidISODate(iso)) return "—";
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "08 November 2026" */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso || !isValidISODate(iso)) return "—";
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** "Nov 2026" */
export function formatMonth(year: number, month: number): string {
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

export function startOfMonthISO(year: number, month: number): string {
  return toISO(year, month, 1);
}

export function endOfMonthISO(year: number, month: number): string {
  return toISO(year, month, daysInMonth(year, month));
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: toISO(year, 1, 1), to: toISO(year, 12, 31) };
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  return { from: startOfMonthISO(year, month), to: endOfMonthISO(year, month) };
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Normalise an optional query-string date; returns undefined when missing/invalid. */
export function parseDateParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && isValidISODate(v) ? v : undefined;
}

/** Normalise a year query param to the supported report range. */
export function parseYearParam(value: string | string[] | undefined, fallback: number): number {
  const v = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(v)) return fallback;
  return Math.min(REPORT_YEAR_END, Math.max(REPORT_YEAR_START, v));
}

export function formatDateTime(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
