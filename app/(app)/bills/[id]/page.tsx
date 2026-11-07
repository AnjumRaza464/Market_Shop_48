import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Printer } from "lucide-react";
import { Suspense } from "react";
import { MarkPaidForm } from "@/components/forms/mark-paid-form";
import { PattiDocument } from "@/components/print/patti";
import { BillStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { cancelBill, deleteBill, markBillPaid, restoreBill, undoBillPayment } from "@/lib/actions/bills";
import { TRANSACTION_TYPES, labelFor, paymentModeLabel } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getBill } from "@/lib/queries/bills";
import { requestToday } from "@/lib/request";
import { billNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Bill" };

export default function BillPage(props: PageProps<"/bills/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <CardSkeleton className="min-h-[600px]" />
          <CardSkeleton />
        </div>
      }
    >
      <BillContent params={props.params} />
    </Suspense>
  );
}

async function BillContent({ params }: Pick<PageProps<"/bills/[id]">, "params">) {
  const { id } = await params;
  const billId = Number(id);
  if (!Number.isInteger(billId)) notFound();
  const [bill, today] = await Promise.all([getBill(billId), requestToday()]);
  if (!bill) notFound();

  return (
    <>
      <PageHeader
        backHref="/bills"
        backLabel="Bills"
        title={
          <span className="flex flex-wrap items-center gap-2">
            Patti {billNumber(bill.id)} <BillStatusBadge status={bill.status} />
          </span>
        }
        description={
          <>
            <Link href={`/parties/${bill.partyId}`} className="font-medium text-foreground hover:underline">
              {bill.party.name}
            </Link>{" "}
            · {formatDate(bill.billDate)}
            {bill.gariNumber ? ` · Gari ${bill.gariNumber}` : ""}
          </>
        }
        actions={
          <>
            {bill.status === "PENDING" ? (
              <LinkButton href={`/bills/${bill.id}/edit`} variant="outline">
                <Pencil /> Edit
              </LinkButton>
            ) : null}
            <LinkButton href={`/print/bills/${bill.id}`}>
              <Printer /> Print patti
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PattiDocument bill={bill} />

        <aside className="space-y-4">
          {bill.status === "PENDING" ? (
            <Card>
              <CardHeader>
                <CardTitle>Settle this patti</CardTitle>
                <CardDescription>
                  Final payable <Money value={bill.finalPayable} className="font-semibold text-foreground" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MarkPaidForm action={markBillPaid.bind(null, bill.id)} defaultDate={today} finalPayable={bill.finalPayable} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Ledger entries</CardTitle>
              <CardDescription>Posted to {bill.party.name}&apos;s khata for this bill.</CardDescription>
            </CardHeader>
            <CardContent>
              {bill.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ledger entries (bill is cancelled).</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {bill.transactions.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium">{labelFor(TRANSACTION_TYPES, t.type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.txnDate)}
                          {t.paymentMode ? ` · ${paymentModeLabel(t.paymentMode)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {Number(t.credit) > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Credit <Money value={t.credit} symbol={false} className="font-medium text-foreground" />
                          </p>
                        ) : null}
                        {Number(t.debit) > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Debit <Money value={t.debit} symbol={false} className="font-medium text-foreground" />
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Created {formatDateTime(bill.createdAt)}
                {bill.updatedAt.getTime() !== bill.createdAt.getTime() ? ` · updated ${formatDateTime(bill.updatedAt)}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {bill.status === "PAID" ? (
                <ConfirmButton action={undoBillPayment.bind(null, bill.id)} variant="outline" confirmText="Remove the payment entry and reopen this bill?" confirmLabel="Yes, undo">
                  Undo payment
                </ConfirmButton>
              ) : null}
              {bill.status === "PENDING" ? (
                <ConfirmButton action={cancelBill.bind(null, bill.id)} variant="outline" confirmText="Cancel this bill? Its ledger credit will be removed." confirmLabel="Yes, cancel">
                  Cancel bill
                </ConfirmButton>
              ) : null}
              {bill.status === "CANCELLED" ? (
                <ConfirmButton action={restoreBill.bind(null, bill.id)} variant="outline" confirmText="Restore this bill and credit the party again?" confirmLabel="Yes, restore">
                  Restore bill
                </ConfirmButton>
              ) : null}
              {bill.status !== "PAID" ? (
                <ConfirmButton action={deleteBill.bind(null, bill.id)} confirmText="Delete permanently? This cannot be undone." confirmLabel="Yes, delete">
                  Delete bill
                </ConfirmButton>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
