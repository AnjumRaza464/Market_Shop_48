import type { Metadata } from "next";
import { Suspense } from "react";
import { BillForm } from "@/components/forms/bill-form";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { createBill } from "@/lib/actions/bills";
import { listPartyOptions } from "@/lib/queries/parties";
import { requestToday } from "@/lib/request";
import { parseIntParam } from "@/lib/utils";

export const metadata: Metadata = { title: "New bill" };

export default function NewBillPage(props: PageProps<"/bills/new">) {
  return (
    <>
      <PageHeader title="New bill (Patti)" description="Record a gari, deduct commission and expenses, and settle with the party." backHref="/bills" backLabel="Bills" />
      <Suspense fallback={<FormSkeleton fields={8} />}>
        <NewBillForm searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewBillForm({ searchParams }: Pick<PageProps<"/bills/new">, "searchParams">) {
  const sp = await searchParams;
  const defaultPartyId = parseIntParam(sp.partyId);
  const [parties, today] = await Promise.all([listPartyOptions(defaultPartyId), requestToday()]);
  return <BillForm action={createBill} parties={parties} defaultDate={today} defaultPartyId={defaultPartyId} cancelHref="/bills" />;
}
