import type { Metadata } from "next";
import { PartyForm } from "@/components/forms/party-form";
import { PageHeader } from "@/components/ui/page-header";
import { createParty } from "@/lib/actions/parties";

export const metadata: Metadata = { title: "New party" };

export default function NewPartyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New supplier party" description="Add a beopari / supplier whose goods you sell on commission." backHref="/parties" backLabel="Suppliers" />
      <PartyForm action={createParty} cancelHref="/parties" />
    </div>
  );
}
