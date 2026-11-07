import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Printer, ReceiptText } from "lucide-react";
import { Suspense } from "react";
import type { BillStatus } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { BillStatusBadge } from "@/components/ui/badge";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { BILL_STATUSES } from "@/lib/constants";
import { formatDate, parseDateParam } from "@/lib/dates";
import { listBills } from "@/lib/queries/bills";
import { billNumber, firstParam, parseIntParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Bills" };

export default function BillsPage(props: PageProps<"/bills">) {
  return (
    <>
      <PageHeader
        title="Bills / Pattis"
        description="Every gari settled with a party. Search by party, gari number or bill number."
        actions={
          <LinkButton href="/bills/new">
            <Plus /> New bill
          </LinkButton>
        }
      />
      <Suspense fallback={<TableSkeleton rows={10} cols={9} />}>
        <BillsTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function BillsTable({ searchParams }: Pick<PageProps<"/bills">, "searchParams">) {
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const statusParam = firstParam(sp.status);
  const status = BILL_STATUSES.some((s) => s.value === statusParam) ? (statusParam as BillStatus) : undefined;
  const partyId = parseIntParam(sp.partyId);
  const page = parseIntParam(sp.page) ?? 1;

  const result = await listBills({ q, from, to, status, partyId, page });
  const params = { q, from, to, status, partyId };

  return (
    <>
      <FilterBar action="/bills" resetHref="/bills" hidden={{ partyId: partyId ? String(partyId) : undefined }}>
        <FilterField label="Search" htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Party, gari or P-00012" className="w-56" />
        </FilterField>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""} className="w-36">
            <option value="">All</option>
            {BILL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptText />}
          title="No bills found"
          description={q || from || to || status ? "Try widening the filters." : "Record your first gari to create a patti."}
          action={
            <LinkButton href="/bills/new">
              <Plus /> New bill
            </LinkButton>
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Bill</Th>
                <Th>Date</Th>
                <Th>Party</Th>
                <Th>Gari</Th>
                <Th>Items</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Commission</Th>
                <Th className="text-right">Expenses</Th>
                <Th className="text-right">Net</Th>
                <Th>Status</Th>
                <Th className="w-24 text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {result.rows.map((b) => (
                <Tr key={b.id} className={b.status === "CANCELLED" ? "text-muted-foreground" : undefined}>
                  <Td className="whitespace-nowrap">
                    <Link href={`/bills/${b.id}`} className="font-medium text-primary hover:underline tabular">
                      {billNumber(b.id)}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap tabular">{formatDate(b.billDate)}</Td>
                  <Td className="whitespace-nowrap">
                    <Link href={`/parties/${b.partyId}`} className="font-medium hover:underline">
                      {b.partyName}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{b.gariNumber ?? "—"}</Td>
                  <Td className="max-w-56 truncate text-muted-foreground" title={b.itemsSummary ?? undefined}>
                    {b.itemsSummary ?? "—"}
                  </Td>
                  <Td className="text-right">
                    <Money value={b.grossAmount} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={b.commissionAmount} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={b.totalExpenses} symbol={false} />
                  </Td>
                  <Td className="text-right font-medium">
                    <Money value={b.netAmount} symbol={false} />
                  </Td>
                  <Td>
                    <BillStatusBadge status={b.status} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Link href={`/print/bills/${b.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Print ${billNumber(b.id)}`}>
                        <Printer />
                      </Link>
                      {b.status === "PENDING" ? (
                        <Link href={`/bills/${b.id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Edit ${billNumber(b.id)}`}>
                          <Pencil />
                        </Link>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={5} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Totals · {result.total} bill(s){status === "CANCELLED" ? "" : " (excl. cancelled)"}
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.gross} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.commission} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.expenses} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.net} symbol={false} />
                </Td>
                <Td colSpan={2} />
              </Tr>
            </TFoot>
          </Table>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/bills" params={params} />
        </>
      )}
    </>
  );
}
