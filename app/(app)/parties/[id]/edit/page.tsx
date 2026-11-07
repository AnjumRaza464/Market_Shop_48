import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PartyForm } from "@/components/forms/party-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { deleteParty, updateParty } from "@/lib/actions/parties";
import { getParty } from "@/lib/queries/parties";

export const metadata: Metadata = { title: "Edit party" };

export default function EditPartyPage(props: PageProps<"/parties/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<FormSkeleton />}>
        <EditPartyContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditPartyContent({ params }: Pick<PageProps<"/parties/[id]/edit">, "params">) {
  const { id } = await params;
  const partyId = Number(id);
  if (!Number.isInteger(partyId)) notFound();
  const party = await getParty(partyId);
  if (!party) notFound();

  return (
    <>
      <PageHeader title={`Edit · ${party.name}`} backHref={`/parties/${party.id}`} backLabel="Party ledger" />
      <PartyForm action={updateParty.bind(null, party.id)} initial={party} cancelHref={`/parties/${party.id}`} />

      <Card className="mt-8 border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            A party can only be deleted when it has no bills or transactions. Otherwise mark it inactive above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmButton action={deleteParty.bind(null, party.id)} confirmText="Delete this party permanently?" confirmLabel="Yes, delete">
            Delete party
          </ConfirmButton>
        </CardContent>
      </Card>
    </>
  );
}
