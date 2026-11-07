import { BillStatusBadge } from "@/components/ui/badge";
import { SHOP } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, formatAmount, formatMoney, formatPct, formatQty } from "@/lib/money";
import type { BillDetail } from "@/lib/queries/bills";
import { billNumber, cn } from "@/lib/utils";
import { amountInWords } from "@/lib/words";

interface PattiDocumentProps {
  bill: BillDetail;
  className?: string;
}

/**
 * Printable settlement receipt (Patti) for one gari/lot. Used both on screen and on the print route.
 */
export function PattiDocument({ bill, className }: PattiDocumentProps) {
  const deductions: { label: string; value: string }[] = [
    { label: `Commission @ ${formatPct(bill.commissionPct)}`, value: bill.commissionAmount },
    { label: "Freight (Kiraya)", value: bill.freight },
    { label: "Labour (Mazdoori)", value: bill.labour },
    { label: "Market fee", value: bill.marketFee },
    { label: "Munshiyana", value: bill.munshiyana },
    { label: bill.otherExpenseNote ? `Other: ${bill.otherExpenseNote}` : "Other expenses", value: bill.otherExpense },
  ].filter((d, i) => i === 0 || !D(d.value).isZero());

  const totalDeductions = D(bill.commissionAmount).plus(D(bill.totalExpenses));

  return (
    <article className={cn("print-page rounded-lg border border-border bg-card p-6 text-sm shadow-xs sm:p-8", className)}>
      <header className="flex flex-col gap-4 border-b-2 border-foreground pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{SHOP.name}</h1>
          {SHOP.address ? <p className="text-muted-foreground">{SHOP.address}</p> : null}
          {SHOP.phone ? <p className="text-muted-foreground">Phone: {SHOP.phone}</p> : null}
        </div>
        <div className="sm:text-right">
          <p className="text-lg font-bold uppercase tracking-wider">Patti / Bill</p>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 sm:justify-end">
            <dt className="text-muted-foreground">Bill no.</dt>
            <dd className="font-semibold tabular">{billNumber(bill.id)}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-semibold">{formatDate(bill.billDate)}</dd>
            {bill.gariNumber ? (
              <>
                <dt className="text-muted-foreground">Gari no.</dt>
                <dd className="font-semibold">{bill.gariNumber}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </header>

      <section className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Party (Beopari)</p>
          <p className="text-base font-semibold">{bill.party.name}</p>
          {bill.party.contactPerson ? <p className="text-muted-foreground">{bill.party.contactPerson}</p> : null}
          {bill.party.phone ? <p className="text-muted-foreground">{bill.party.phone}</p> : null}
          {bill.party.address ? <p className="text-muted-foreground">{bill.party.address}</p> : null}
        </div>
        <div className="no-print">
          <BillStatusBadge status={bill.status} />
        </div>
      </section>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-foreground/60 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-2 text-left font-semibold">#</th>
            <th className="py-2 pr-2 text-left font-semibold">Item</th>
            <th className="py-2 px-2 text-left font-semibold">Size</th>
            <th className="py-2 px-2 text-right font-semibold">Qty</th>
            <th className="py-2 px-2 text-left font-semibold">Unit</th>
            <th className="py-2 px-2 text-right font-semibold">Rate</th>
            <th className="py-2 pl-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={item.id} className="border-b border-border">
              <td className="py-2 pr-2 text-muted-foreground tabular">{i + 1}</td>
              <td className="py-2 pr-2 font-medium">{item.itemName}</td>
              <td className="py-2 px-2 text-muted-foreground">{item.size ?? "—"}</td>
              <td className="py-2 px-2 text-right tabular">{formatQty(item.quantity)}</td>
              <td className="py-2 px-2 text-muted-foreground">{item.unit}</td>
              <td className="py-2 px-2 text-right tabular">{formatAmount(item.rate)}</td>
              <td className="py-2 pl-2 text-right font-medium tabular">{formatAmount(item.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-foreground/60">
            <td colSpan={6} className="py-2 text-right font-semibold">
              Gross amount
            </td>
            <td className="py-2 pl-2 text-right font-bold tabular">{formatAmount(bill.grossAmount)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="mt-5 grid gap-6 sm:grid-cols-[1fr_minmax(260px,320px)]">
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount in words</p>
            <p className="mt-1 font-medium">{amountInWords(bill.finalPayable)}</p>
          </div>
          {bill.notes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">{bill.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-border print-break-inside-avoid">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="px-3 py-1.5">Gross amount</td>
                <td className="px-3 py-1.5 text-right font-medium tabular">{formatAmount(bill.grossAmount)}</td>
              </tr>
              {deductions.map((d) => (
                <tr key={d.label} className="text-muted-foreground">
                  <td className="px-3 py-1">Less: {d.label}</td>
                  <td className="px-3 py-1 text-right tabular">− {formatAmount(d.value)}</td>
                </tr>
              ))}
              <tr className="border-y border-border">
                <td className="px-3 py-1.5">Total deductions</td>
                <td className="px-3 py-1.5 text-right font-medium tabular">− {formatAmount(totalDeductions)}</td>
              </tr>
              <tr className={cn(D(bill.advanceAdjusted).isZero() ? "bg-muted/60 font-bold" : "font-semibold")}>
                <td className="px-3 py-2">Net amount</td>
                <td className="px-3 py-2 text-right tabular">{formatAmount(bill.netAmount)}</td>
              </tr>
              {!D(bill.advanceAdjusted).isZero() ? (
                <>
                  <tr className="text-muted-foreground">
                    <td className="px-3 py-1">Less: Advance adjusted</td>
                    <td className="px-3 py-1 text-right tabular">− {formatAmount(bill.advanceAdjusted)}</td>
                  </tr>
                  <tr className="border-t border-foreground/60 bg-muted/60 font-bold">
                    <td className="px-3 py-2">Final payable</td>
                    <td className="px-3 py-2 text-right tabular">{formatMoney(bill.finalPayable)}</td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-12 grid grid-cols-3 gap-6 text-center text-xs text-muted-foreground print-break-inside-avoid">
        <div className="border-t border-foreground/60 pt-2">Party signature</div>
        <div className="border-t border-foreground/60 pt-2">Munshi</div>
        <div className="border-t border-foreground/60 pt-2">For {SHOP.name}</div>
      </footer>
    </article>
  );
}
