import Link from "next/link";
import { formatDueBalance } from "@/components/ui/money";
import { SHOP, paymentModeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, formatAmount, formatQty } from "@/lib/money";
import type { CustomerLedger } from "@/lib/queries/customers";
import { cn } from "@/lib/utils";

interface CustomerStatementProps {
  ledger: CustomerLedger;
  /** Show edit links (screen only). */
  editable?: boolean;
  className?: string;
}

/** Printable customer khata (Party Ledger sheet): goods given, cash received, running balance. */
export function CustomerStatementDocument({ ledger, editable = true, className }: CustomerStatementProps) {
  const { customer } = ledger;
  const periodLabel =
    ledger.from || ledger.to ? `${ledger.from ? formatDate(ledger.from) : "Start"} – ${ledger.to ? formatDate(ledger.to) : "Today"}` : "All entries";

  return (
    <article className={cn("print-page rounded-lg border border-border bg-card p-6 text-sm shadow-xs sm:p-8", className)}>
      <header className="flex flex-col gap-4 border-b-2 border-foreground pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{SHOP.name}</h1>
          {SHOP.address ? <p className="text-muted-foreground">{SHOP.address}</p> : null}
          {SHOP.phone ? <p className="text-muted-foreground">Phone: {SHOP.phone}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-lg font-bold uppercase tracking-wider">Customer khata</p>
          <p className="text-muted-foreground">{periodLabel}</p>
        </div>
      </header>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
          <p className="text-base font-semibold">{customer.name}</p>
          {customer.contactPerson ? <p className="text-muted-foreground">{customer.contactPerson}</p> : null}
          {customer.phone ? <p className="text-muted-foreground">{customer.phone}</p> : null}
          {customer.city ? <p className="text-muted-foreground">{customer.city}</p> : null}
          {customer.address ? <p className="text-muted-foreground">{customer.address}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:justify-self-end">
          <dt className="text-muted-foreground">Opening balance</dt>
          <dd className="text-right font-medium tabular">{formatDueBalance(customer.openingBalance)}</dd>
          <dt className="text-muted-foreground">Total goods given</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.lifetime.debit)}</dd>
          <dt className="text-muted-foreground">Total received</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.lifetime.credit)}</dd>
          <dt className="text-muted-foreground">Closing balance</dt>
          <dd className="text-right font-semibold tabular">{formatDueBalance(ledger.lifetime.balance)}</dd>
          {ledger.from || ledger.to ? (
            <>
              <dt className="text-muted-foreground">Period goods</dt>
              <dd className="text-right font-medium tabular">{formatAmount(ledger.totals.debit)}</dd>
              <dt className="text-muted-foreground">Period received</dt>
              <dd className="text-right font-medium tabular">{formatAmount(ledger.totals.credit)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-foreground/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-2 text-left font-semibold">Date</th>
            <th className="py-2 px-2 text-left font-semibold">Item</th>
            <th className="py-2 px-2 text-right font-semibold">Qty</th>
            <th className="py-2 px-2 text-right font-semibold">Rate</th>
            <th className="py-2 px-2 text-right font-semibold">Debit (goods)</th>
            <th className="py-2 px-2 text-right font-semibold">Credit (received)</th>
            <th className="py-2 px-2 text-left font-semibold">Mode / ref</th>
            <th className="py-2 pl-2 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border bg-muted/40 italic">
            <td className="py-2 pr-2">{ledger.from ? formatDate(ledger.from) : "—"}</td>
            <td className="py-2 px-2" colSpan={6}>
              {ledger.from ? "Balance before this period" : "Opening balance"}
            </td>
            <td className="py-2 pl-2 text-right font-medium tabular">{formatDueBalance(ledger.openingBalance)}</td>
          </tr>
          {ledger.rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-6 text-center text-muted-foreground">
                No entries in this period.
              </td>
            </tr>
          ) : null}
          {ledger.rows.map((row) => (
            <tr key={row.id} className="border-b border-border">
              <td className="py-2 pr-2 whitespace-nowrap tabular">
                {editable ? (
                  <Link href={`/sales/${row.id}/edit?returnTo=/customers/${customer.id}`} className="text-primary hover:underline">
                    {formatDate(row.entryDate)}
                  </Link>
                ) : (
                  formatDate(row.entryDate)
                )}
              </td>
              <td className="py-2 px-2">
                {row.itemName ? <span className="font-medium">{row.itemName}</span> : <span className="text-muted-foreground">Payment received</span>}
                {row.remarks ? <span className="text-muted-foreground"> · {row.remarks}</span> : null}
              </td>
              <td className="py-2 px-2 text-right tabular">{row.quantity ? `${formatQty(row.quantity)} ${row.unit ?? ""}`.trim() : ""}</td>
              <td className="py-2 px-2 text-right tabular">{row.rate ? formatAmount(row.rate) : ""}</td>
              <td className="py-2 px-2 text-right tabular">{D(row.debit).isZero() ? "" : formatAmount(row.debit)}</td>
              <td className="py-2 px-2 text-right tabular">{D(row.credit).isZero() ? "" : formatAmount(row.credit)}</td>
              <td className="py-2 px-2 text-muted-foreground">
                {[row.paymentMode ? paymentModeLabel(row.paymentMode) : null, row.reference].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="py-2 pl-2 text-right font-medium tabular">{formatDueBalance(row.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/60 font-semibold">
            <td colSpan={2} className="py-2 pr-2 text-right">
              Totals
            </td>
            <td className="py-2 px-2 text-right tabular">{D(ledger.totals.qty).isZero() ? "" : formatQty(ledger.totals.qty)}</td>
            <td />
            <td className="py-2 px-2 text-right tabular">{formatAmount(ledger.totals.debit)}</td>
            <td className="py-2 px-2 text-right tabular">{formatAmount(ledger.totals.credit)}</td>
            <td />
            <td className="py-2 pl-2 text-right tabular">{formatDueBalance(ledger.closingBalance)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-4 text-xs text-muted-foreground">
        Debit = goods given on udhaar · Credit = cash received · Dr balance = amount still to be collected from {customer.name} · Cr balance = customer has paid in advance.
      </p>

      <footer className="mt-12 grid grid-cols-2 gap-6 text-center text-xs text-muted-foreground print-break-inside-avoid">
        <div className="border-t border-foreground/60 pt-2">Customer signature</div>
        <div className="border-t border-foreground/60 pt-2">For {SHOP.name}</div>
      </footer>
    </article>
  );
}
