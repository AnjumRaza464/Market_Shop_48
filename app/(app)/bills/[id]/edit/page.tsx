import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BillForm } from "@/components/forms/bill-form";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { updateBill } from "@/lib/actions/bills";
import { getBill } from "@/lib/queries/bills";
import { listPartyOptions } from "@/lib/queries/parties";
import { requestToday } from "@/lib/request";
import { billNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit bill" };

export default function EditBillPage(props: PageProps<"/bills/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton fields={8} />}>
      <EditBillContent params={props.params} />
    </Suspense>
  );
}

async function EditBillContent({ params }: Pick<PageProps<"/bills/[id]/edit">, "params">) {
  const { id } = await params;
  const billId = Number(id);
  if (!Number.isInteger(billId)) notFound();
  const bill = await getBill(billId);
  if (!bill) notFound();

  if (bill.status !== "PENDING") {
    return (
      <>
        <PageHeader title={`Edit ${billNumber(bill.id)}`} backHref={`/bills/${bill.id}`} backLabel="Bill" />
        <EmptyState
          title="This bill is locked"
          description={
            bill.status === "PAID"
              ? "Paid bills cannot be edited. Undo the payment from the bill page first."
              : "Cancelled bills cannot be edited. Restore the bill first."
          }
          action={<LinkButton href={`/bills/${bill.id}`}>Open bill</LinkButton>}
        />
      </>
    );
  }

  const [parties, today] = await Promise.all([listPartyOptions(bill.partyId), requestToday()]);
  return (
    <>
      <PageHeader title={`Edit ${billNumber(bill.id)}`} description={`${bill.party.name} · recalculates commission, expenses and the ledger entry.`} backHref={`/bills/${bill.id}`} backLabel="Bill" />
      <BillForm action={updateBill.bind(null, bill.id)} parties={parties} defaultDate={today} initial={bill} cancelHref={`/bills/${bill.id}`} />
    </>
  );
}
