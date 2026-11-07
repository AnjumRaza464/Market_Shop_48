import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerForm } from "@/components/forms/customer-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { deleteCustomer, updateCustomer } from "@/lib/actions/customers";
import { getCustomer } from "@/lib/queries/customers";

export const metadata: Metadata = { title: "Edit customer" };

export default function EditCustomerPage(props: PageProps<"/customers/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<FormSkeleton />}>
        <EditCustomerContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditCustomerContent({ params }: Pick<PageProps<"/customers/[id]/edit">, "params">) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();
  const customer = await getCustomer(customerId);
  if (!customer) notFound();

  return (
    <>
      <PageHeader title={`Edit · ${customer.name}`} backHref={`/customers/${customer.id}`} backLabel="Customer khata" />
      <CustomerForm action={updateCustomer.bind(null, customer.id)} initial={customer} cancelHref={`/customers/${customer.id}`} />

      <Card className="mt-8 border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>A customer can only be deleted when it has no khata entries. Otherwise mark it inactive above.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmButton action={deleteCustomer.bind(null, customer.id)} confirmText="Delete this customer permanently?" confirmLabel="Yes, delete">
            Delete customer
          </ConfirmButton>
        </CardContent>
      </Card>
    </>
  );
}
