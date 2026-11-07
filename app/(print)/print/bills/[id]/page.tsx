import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PattiDocument } from "@/components/print/patti";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getBill } from "@/lib/queries/bills";
import { billNumber, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Print patti" };

export default function PrintBillPage(props: PageProps<"/print/bills/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton className="min-h-[600px]" />}>
      <PrintBillContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PrintBillContent({ params, searchParams }: Pick<PageProps<"/print/bills/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const billId = Number(id);
  if (!Number.isInteger(billId)) notFound();
  const bill = await getBill(billId);
  if (!bill) notFound();

  return (
    <>
      <PrintToolbar backHref={`/bills/${bill.id}`} backLabel="Back to bill" title={`Patti ${billNumber(bill.id)} · ${bill.party.name}`} autoPrint={firstParam(sp.auto) === "1"} />
      <PattiDocument bill={bill} />
    </>
  );
}
