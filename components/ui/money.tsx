import { D, formatMoney, type Numeric } from "@/lib/money";
import { cn } from "@/lib/utils";

interface MoneyProps {
  value: Numeric;
  /** Colour negatives red and positives green. */
  colorize?: boolean;
  /** Prefix positives with "+". */
  signed?: boolean;
  symbol?: boolean;
  className?: string;
}

export function Money({ value, colorize, signed, symbol = true, className }: MoneyProps) {
  const d = D(value);
  const tone = colorize
    ? d.isNegative() && !d.isZero()
      ? "text-destructive"
      : d.greaterThan(0)
        ? "text-success"
        : "text-muted-foreground"
    : undefined;
  return <span className={cn("tabular whitespace-nowrap", tone, className)}>{formatMoney(d, { signed, symbol })}</span>;
}

/**
 * Supplier-party balance in plain words: positive = we owe the party, negative = party owes us.
 */
export function BalanceLabel({ value, className }: { value: Numeric; className?: string }) {
  const d = D(value);
  if (d.isZero()) return <span className={cn("text-xs text-muted-foreground", className)}>Settled</span>;
  if (d.greaterThan(0)) return <span className={cn("text-xs text-warning", className)}>Payable to party</span>;
  return <span className={cn("text-xs text-info", className)}>Receivable from party</span>;
}

/**
 * Customer balance in plain words: positive = customer owes us (due), negative = customer paid ahead.
 */
export function DueLabel({ value, className }: { value: Numeric; className?: string }) {
  const d = D(value);
  if (d.isZero()) return <span className={cn("text-xs text-muted-foreground", className)}>Clear</span>;
  if (d.greaterThan(0)) return <span className={cn("text-xs text-destructive", className)}>Due from customer</span>;
  return <span className={cn("text-xs text-info", className)}>Advance from customer</span>;
}

/** "12,500.00 Dr" for customer khatas – Dr = due from customer, Cr = customer paid in advance. */
export function formatDueBalance(value: Numeric): string {
  const d = D(value);
  if (d.isZero()) return "0.00";
  return `${formatMoney(d.abs(), { symbol: false })} ${d.isNegative() ? "Cr" : "Dr"}`;
}
