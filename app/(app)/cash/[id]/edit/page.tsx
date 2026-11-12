import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CashEntryForm } from "@/components/forms/cash-entry-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { updateCashEntry } from "@/lib/actions/cash";
import { getCashEntry } from "@/lib/queries/cash";
import { listPartnerOptions } from "@/lib/queries/partners";

export const metadata: Metadata = { title: "Edit cash entry" };

export default function EditCashEntryPage(props: PageProps<"/cash/[id]/edit">) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit cash entry" backHref="/cash" backLabel="Cash in hand" />
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <EditCashEntryContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditCashEntryContent({ params }: Pick<PageProps<"/cash/[id]/edit">, "params">) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) notFound();
  const entry = await getCashEntry(entryId);
  if (!entry) notFound();
  const partners = await listPartnerOptions(entry.partnerId);

  return (
    <Card>
      <CardContent className="pt-5">
        <CashEntryForm action={updateCashEntry.bind(null, entry.id)} defaultDate={entry.entryDate} partners={partners} initial={entry} mode="edit" cancelHref="/cash" />
      </CardContent>
    </Card>
  );
}
