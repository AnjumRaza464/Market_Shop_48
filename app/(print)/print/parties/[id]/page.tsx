import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { StatementDocument } from "@/components/print/statement";
import { CardSkeleton } from "@/components/ui/skeleton";
import { parseDateParam } from "@/lib/dates";
import { getPartyLedger } from "@/lib/queries/parties";
import { firstParam, qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Print statement" };

export default function PrintStatementPage(props: PageProps<"/print/parties/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton className="min-h-[600px]" />}>
      <PrintStatementContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PrintStatementContent({ params, searchParams }: Pick<PageProps<"/print/parties/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const partyId = Number(id);
  if (!Number.isInteger(partyId)) notFound();
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const ledger = await getPartyLedger(partyId, { from, to });
  if (!ledger) notFound();

  return (
    <>
      <PrintToolbar backHref={`/parties/${partyId}${qs({ from, to })}`} backLabel="Back to ledger" title={`Statement · ${ledger.party.name}`} autoPrint={firstParam(sp.auto) === "1"} />
      <StatementDocument ledger={ledger} linkBills={false} />
    </>
  );
}
