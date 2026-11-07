import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SaleEntryForm } from "@/components/forms/sale-entry-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { updateSaleEntry } from "@/lib/actions/sales";
import { listCustomerOptions } from "@/lib/queries/customers";
import { getSaleEntry, listSaleItems } from "@/lib/queries/sales";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit khata entry" };

export default function EditSaleEntryPage(props: PageProps<"/sales/[id]/edit">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<FormSkeleton fields={8} />}>
        <EditSaleEntryContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function EditSaleEntryContent({ params, searchParams }: Pick<PageProps<"/sales/[id]/edit">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) notFound();
  const entry = await getSaleEntry(entryId);
  if (!entry) notFound();
  const returnToParam = firstParam(sp.returnTo);
  const returnTo = returnToParam && returnToParam.startsWith("/") && !returnToParam.startsWith("//") ? returnToParam : `/customers/${entry.customerId}`;
  const [customers, items] = await Promise.all([listCustomerOptions(entry.customerId), listSaleItems()]);

  return (
    <>
      <PageHeader title="Edit khata entry" backHref={returnTo} backLabel="Back" />
      <Card>
        <CardContent className="pt-5">
          <SaleEntryForm
            action={updateSaleEntry.bind(null, entry.id)}
            customers={customers}
            items={items}
            defaultDate={entry.entryDate}
            initial={entry}
            mode="edit"
            returnTo={returnTo}
            cancelHref={returnTo}
          />
        </CardContent>
      </Card>
    </>
  );
}
