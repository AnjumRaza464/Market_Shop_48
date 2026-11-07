import type { Metadata } from "next";
import { CustomerForm } from "@/components/forms/customer-form";
import { PageHeader } from "@/components/ui/page-header";
import { createCustomer } from "@/lib/actions/customers";

export const metadata: Metadata = { title: "New customer" };

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New customer" description="Add a buyer to the customer khata." backHref="/customers" backLabel="Customers" />
      <CustomerForm action={createCustomer} cancelHref="/customers" />
    </div>
  );
}
