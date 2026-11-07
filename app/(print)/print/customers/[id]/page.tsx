import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerStatementDocument } from "@/components/print/customer-statement";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { CardSkeleton } from "@/components/ui/skeleton";
import { parseDateParam } from "@/lib/dates";
import { getCustomerLedger } from "@/lib/queries/customers";
import { firstParam, qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Print customer khata" };

export default function PrintCustomerPage(props: PageProps<"/print/customers/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton className="min-h-[600px]" />}>
      <PrintCustomerContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PrintCustomerContent({ params, searchParams }: Pick<PageProps<"/print/customers/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const ledger = await getCustomerLedger(customerId, { from, to });
  if (!ledger) notFound();

  return (
    <>
      <PrintToolbar
        backHref={`/customers/${customerId}${qs({ from, to })}`}
        backLabel="Back to khata"
        title={`Customer khata · ${ledger.customer.name}`}
        autoPrint={firstParam(sp.auto) === "1"}
      />
      <CustomerStatementDocument ledger={ledger} editable={false} />
    </>
  );
}
