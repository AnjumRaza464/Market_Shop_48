import type { Metadata } from "next";
import { Suspense } from "react";
import type { TransactionType } from "@/db/schema";
import { TransactionForm } from "@/components/forms/transaction-form";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { createTransaction } from "@/lib/actions/transactions";
import { MANUAL_TRANSACTION_TYPES } from "@/lib/constants";
import { listPartyOptions } from "@/lib/queries/parties";
import { requestToday } from "@/lib/request";
import { firstParam, parseIntParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Record transaction" };

export default function NewTransactionPage(props: PageProps<"/transactions/new">) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Record payment / advance" description="Post cash or bank movements to a party's khata." backHref="/transactions" backLabel="Payments & advances" />
      <Suspense fallback={<FormSkeleton />}>
        <NewTransactionForm searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function NewTransactionForm({ searchParams }: Pick<PageProps<"/transactions/new">, "searchParams">) {
  const sp = await searchParams;
  const defaultPartyId = parseIntParam(sp.partyId);
  const typeParam = firstParam(sp.type);
  const defaultType = MANUAL_TRANSACTION_TYPES.some((t) => t.value === typeParam)
    ? (typeParam as Exclude<TransactionType, "BILL">)
    : undefined;
  const returnToParam = firstParam(sp.returnTo);
  const returnTo = returnToParam && returnToParam.startsWith("/") && !returnToParam.startsWith("//") ? returnToParam : undefined;

  const [parties, today] = await Promise.all([listPartyOptions(defaultPartyId), requestToday()]);
  return (
    <TransactionForm
      action={createTransaction}
      parties={parties}
      defaultDate={today}
      defaultPartyId={defaultPartyId}
      defaultType={defaultType}
      returnTo={returnTo}
      cancelHref={returnTo ?? "/transactions"}
    />
  );
}
