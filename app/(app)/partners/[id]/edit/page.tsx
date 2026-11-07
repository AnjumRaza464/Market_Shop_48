import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PartnerForm } from "@/components/forms/partner-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { updatePartner } from "@/lib/actions/partners";
import { getPartner } from "@/lib/queries/partners";

export const metadata: Metadata = { title: "Edit partner" };

export default function EditPartnerPage(props: PageProps<"/partners/[id]/edit">) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit partner" backHref="/partners" backLabel="Partners" />
      <Suspense fallback={<FormSkeleton fields={5} />}>
        <EditPartnerContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditPartnerContent({ params }: Pick<PageProps<"/partners/[id]/edit">, "params">) {
  const { id } = await params;
  const partnerId = Number(id);
  if (!Number.isInteger(partnerId)) notFound();
  const partner = await getPartner(partnerId);
  if (!partner) notFound();

  return (
    <Card>
      <CardContent className="pt-5">
        <PartnerForm action={updatePartner.bind(null, partner.id)} initial={partner} mode="edit" cancelHref="/partners" />
      </CardContent>
    </Card>
  );
}
