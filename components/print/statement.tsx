import Link from "next/link";
import { SHOP, TRANSACTION_TYPES, labelFor, paymentModeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, formatAmount } from "@/lib/money";
import type { PartyLedger } from "@/lib/queries/parties";
import { billNumber, cn } from "@/lib/utils";

/** "12,500.00 Cr" – Cr = shop owes party, Dr = party owes shop. */
export function formatLedgerBalance(value: string): string {
  const d = D(value);
  if (d.isZero()) return "0.00";
  return `${formatAmount(d.abs())} ${d.isNegative() ? "Dr" : "Cr"}`;
}

interface StatementDocumentProps {
  ledger: PartyLedger;
  /** Link bill references to their patti pages (screen only). */
  linkBills?: boolean;
  className?: string;
}

export function StatementDocument({ ledger, linkBills = true, className }: StatementDocumentProps) {
  const { party } = ledger;
  const periodLabel =
    ledger.from || ledger.to ? `${ledger.from ? formatDate(ledger.from) : "Start"} – ${ledger.to ? formatDate(ledger.to) : "Today"}` : "All transactions";

  return (
    <article className={cn("print-page rounded-lg border border-border bg-card p-6 text-sm shadow-xs sm:p-8", className)}>
      <header className="flex flex-col gap-4 border-b-2 border-foreground pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{SHOP.name}</h1>
          {SHOP.address ? <p className="text-muted-foreground">{SHOP.address}</p> : null}
          {SHOP.phone ? <p className="text-muted-foreground">Phone: {SHOP.phone}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-lg font-bold uppercase tracking-wider">Statement of account</p>
          <p className="text-muted-foreground">{periodLabel}</p>
        </div>
      </header>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Party</p>
          <p className="text-base font-semibold">{party.name}</p>
          {party.contactPerson ? <p className="text-muted-foreground">{party.contactPerson}</p> : null}
          {party.phone ? <p className="text-muted-foreground">{party.phone}</p> : null}
          {party.address ? <p className="text-muted-foreground">{party.address}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:justify-self-end">
          <dt className="text-muted-foreground">Goods sold (gross)</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.billStats.gross)}</dd>
          <dt className="text-muted-foreground">Commission deducted</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.billStats.commission)}</dd>
          <dt className="text-muted-foreground">Expenses deducted</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.billStats.expenses)}</dd>
          <dt className="text-muted-foreground">Net credited</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.totals.billsCredited)}</dd>
          <dt className="text-muted-foreground">Paid to party</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.totals.payments)}</dd>
          <dt className="text-muted-foreground">Advances given</dt>
          <dd className="text-right font-medium tabular">{formatAmount(ledger.totals.advances)}</dd>
        </dl>
      </section>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-foreground/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-2 text-left font-semibold">Date</th>
            <th className="py-2 px-2 text-left font-semibold">Particulars</th>
            <th className="py-2 px-2 text-left font-semibold">Ref</th>
            <th className="py-2 px-2 text-right font-semibold">Debit</th>
            <th className="py-2 px-2 text-right font-semibold">Credit</th>
            <th className="py-2 pl-2 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border bg-muted/40 italic">
            <td className="py-2 pr-2">{ledger.from ? formatDate(ledger.from) : "—"}</td>
            <td className="py-2 px-2" colSpan={4}>
              {ledger.from ? "Balance brought forward" : "Opening balance"}
            </td>
            <td className="py-2 pl-2 text-right font-medium tabular">{formatLedgerBalance(ledger.openingBalance)}</td>
          </tr>
          {ledger.rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                No transactions in this period.
              </td>
            </tr>
          ) : null}
          {ledger.rows.map((row) => (
            <tr key={row.id} className="border-b border-border">
              <td className="py-2 pr-2 whitespace-nowrap tabular">{formatDate(row.txnDate)}</td>
              <td className="py-2 px-2">
                <span className="font-medium">{labelFor(TRANSACTION_TYPES, row.type)}</span>
                {row.description ? <span className="text-muted-foreground"> · {row.description}</span> : null}
                {row.paymentMode ? <span className="text-muted-foreground"> ({paymentModeLabel(row.paymentMode)})</span> : null}
              </td>
              <td className="py-2 px-2 whitespace-nowrap tabular">
                {row.referenceId ? (
                  linkBills ? (
                    <Link href={`/bills/${row.referenceId}`} className="text-primary hover:underline">
                      {billNumber(row.referenceId)}
                    </Link>
                  ) : (
                    billNumber(row.referenceId)
                  )
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 px-2 text-right tabular">{D(row.debit).isZero() ? "" : formatAmount(row.debit)}</td>
              <td className="py-2 px-2 text-right tabular">{D(row.credit).isZero() ? "" : formatAmount(row.credit)}</td>
              <td className="py-2 pl-2 text-right font-medium tabular">{formatLedgerBalance(row.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/60 font-semibold">
            <td colSpan={3} className="py-2 pr-2 text-right">
              Totals
            </td>
            <td className="py-2 px-2 text-right tabular">{formatAmount(ledger.totals.debit)}</td>
            <td className="py-2 px-2 text-right tabular">{formatAmount(ledger.totals.credit)}</td>
            <td className="py-2 pl-2 text-right tabular">{formatLedgerBalance(ledger.closingBalance)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-4 text-xs text-muted-foreground">
        Cr = amount payable by {SHOP.name} to the party · Dr = amount receivable from the party (advance outstanding).
      </p>

      <footer className="mt-12 grid grid-cols-2 gap-6 text-center text-xs text-muted-foreground print-break-inside-avoid">
        <div className="border-t border-foreground/60 pt-2">Party signature</div>
        <div className="border-t border-foreground/60 pt-2">For {SHOP.name}</div>
      </footer>
    </article>
  );
}
