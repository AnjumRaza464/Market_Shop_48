import { addDays, endOfMonthISO, formatMonth, isValidISODate, startOfMonthISO, yearRange } from "@/lib/dates";

export type PeriodKey = "month" | "last-month" | "year" | "all" | "custom";

export interface ResolvedPeriod {
  key: PeriodKey;
  from?: string;
  to?: string;
  label: string;
}

export const PERIOD_OPTIONS: { key: Exclude<PeriodKey, "custom">; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

/** Turn `?period=` / `?from=&to=` query params into a concrete date range. */
export function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  today: string,
  defaultKey: Exclude<PeriodKey, "custom"> = "month",
): ResolvedPeriod {
  const from = params.from && isValidISODate(params.from) ? params.from : undefined;
  const to = params.to && isValidISODate(params.to) ? params.to : undefined;
  if (from || to) {
    return { key: "custom", from, to, label: `${from ?? "…"} → ${to ?? "…"}` };
  }

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const key = (params.period as PeriodKey | undefined) ?? defaultKey;

  switch (key) {
    case "last-month": {
      const firstOfThisMonth = startOfMonthISO(year, month);
      const lastMonthEnd = addDays(firstOfThisMonth, -1);
      const ly = Number(lastMonthEnd.slice(0, 4));
      const lm = Number(lastMonthEnd.slice(5, 7));
      return { key, from: startOfMonthISO(ly, lm), to: endOfMonthISO(ly, lm), label: formatMonth(ly, lm) };
    }
    case "year": {
      const r = yearRange(year);
      return { key, ...r, label: String(year) };
    }
    case "all":
      return { key, label: "All time" };
    case "month":
    default:
      return { key: "month", from: startOfMonthISO(year, month), to: endOfMonthISO(year, month), label: formatMonth(year, month) };
  }
}
