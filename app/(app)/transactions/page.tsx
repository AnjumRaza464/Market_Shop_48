import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, Plus } from "lucide-react";
import { Suspense } from "react";
import type { TransactionType } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { deleteTransaction } from "@/lib/actions/transactions";
import { TRANSACTION_TYPES, labelFor, paymentModeLabel } from "@/lib/constants";
import { formatDate, parseDateParam } from "@/lib/dates";
import { listPartyOptions } from "@/lib/queries/parties";
import { listTransactions } from "@/lib/queries/transactions";
import { billNumber, firstParam, parseIntParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments & advances" };

export default function TransactionsPage(props: PageProps<"/transactions">) {
  return (
    <>
      <PageHeader
        title="Payments & Advances"
        description="Cash and bank movements with parties. Bill entries are created automatically from pattis."
        actions={
          <LinkButton href="/transactions/new">
            <Plus /> Record transaction
          </LinkButton>
        }
      />
      <Suspense fallback={<TableSkeleton rows={10} cols={7} />}>
        <TransactionsTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const typeBadge: Record<TransactionType, "primary" | "success" | "info" | "warning" | "default"> = {
  BILL: "primary",
  PAYMENT: "success",
  ADVANCE: "info",
  RECEIPT: "warning",
  ADJUSTMENT: "default",
};

async function TransactionsTable({ searchParams }: Pick<PageProps<"/transactions">, "searchParams">) {
  const sp = await searchParams;
  const partyId = parseIntParam(sp.partyId);
  const typeParam = firstParam(sp.type);
  const type = TRANSACTION_TYPES.some((t) => t.value === typeParam) ? (typeParam as TransactionType) : undefined;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const page = parseIntParam(sp.page) ?? 1;

  const [result, parties] = await Promise.all([listTransactions({ partyId, type, from, to, page }), listPartyOptions(partyId)]);
  const params = { partyId, type, from, to };

  return (
    <>
      <FilterBar action="/transactions" resetHref="/transactions">
        <FilterField label="Party" htmlFor="partyId">
          <Select id="partyId" name="partyId" defaultValue={partyId ? String(partyId) : ""} className="w-52">
            <option value="">All parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type" htmlFor="type">
          <Select id="type" name="type" defaultValue={type ?? ""} className="w-44">
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
        </FilterField>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<HandCoins />}
          title="No transactions found"
          description="Record a payment or advance to a party, or widen the filters."
          action={
            <LinkButton href="/transactions/new">
              <Plus /> Record transaction
            </LinkButton>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th>Party</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Ref</Th>
                <Th>Mode</Th>
                <Th className="text-right">Debit</Th>
                <Th className="text-right">Credit</Th>
                <Th className="w-28 text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {result.rows.map((t) => (
                <Tr key={t.id}>
                  <Td className="whitespace-nowrap tabular">{formatDate(t.txnDate)}</Td>
                  <Td>
                    <Link href={`/parties/${t.partyId}`} className="font-medium hover:underline">
                      {t.partyName}
                    </Link>
                  </Td>
                  <Td>
                    <Badge variant={typeBadge[t.type]}>{labelFor(TRANSACTION_TYPES, t.type)}</Badge>
                  </Td>
                  <Td className="max-w-72 truncate text-muted-foreground" title={t.description ?? undefined}>
                    {t.description ?? "—"}
                  </Td>
                  <Td className="tabular">
                    {t.referenceId ? (
                      <Link href={`/bills/${t.referenceId}`} className="text-primary hover:underline">
                        {billNumber(t.referenceId)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{t.paymentMode ? paymentModeLabel(t.paymentMode) : "—"}</Td>
                  <Td className="text-right">{Number(t.debit) > 0 ? <Money value={t.debit} symbol={false} /> : null}</Td>
                  <Td className="text-right">{Number(t.credit) > 0 ? <Money value={t.credit} symbol={false} /> : null}</Td>
                  <Td className="text-right">
                    {t.type !== "BILL" && !t.referenceId ? (
                      <ConfirmButton action={deleteTransaction.bind(null, t.id)} variant="ghost" size="sm" confirmText="Delete?" confirmLabel="Yes" className="text-destructive">
                        Delete
                      </ConfirmButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">via bill</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={6} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Totals · {result.total} transaction(s)
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.debit} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.credit} symbol={false} />
                </Td>
                <Td />
              </Tr>
            </TFoot>
          </Table>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/transactions" params={params} />
        </>
      )}
    </>
  );
}
