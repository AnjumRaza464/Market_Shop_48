import Link from "next/link";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/periods";
import { cn, qs } from "@/lib/utils";

interface PeriodLinksProps {
  basePath: string;
  active: PeriodKey;
  params?: Record<string, string | undefined>;
  className?: string;
}

export function PeriodLinks({ basePath, active, params, className }: PeriodLinksProps) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 no-print", className)}>
      {PERIOD_OPTIONS.map((opt) => (
        <Link
          key={opt.key}
          href={`${basePath}${qs({ ...params, period: opt.key, from: undefined, to: undefined })}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === opt.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}

interface YearPickerProps {
  basePath: string;
  years: number[];
  active: number;
  params?: Record<string, string | undefined>;
}

export function YearPicker({ basePath, years, active, params }: YearPickerProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 no-print">
      {years.map((y) => (
        <Link
          key={y}
          href={`${basePath}${qs({ ...params, year: y })}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium tabular transition-colors",
            active === y ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {y}
        </Link>
      ))}
    </div>
  );
}
