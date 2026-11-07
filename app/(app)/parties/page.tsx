import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Users } from "lucide-react";
import { Suspense } from "react";
import type { PartyStatus } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { BalanceLabel, Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { D, formatPct, ZERO } from "@/lib/money";
import { listParties } from "@/lib/queries/parties";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Parties" };

export default function PartiesPage(props: PageProps<"/parties">) {
  return (
    <>
      <PageHeader
        title="Supplier Parties (Beopari)"
        description="Parties whose goods you sell on commission. Click a party to open its ledger and patti history."
        actions={
          <LinkButton href="/parties/new">
            <Plus /> New supplier party
          </LinkButton>
        }
      />
      <Suspense fallback={<TableSkeleton rows={8} cols={7} />}>
        <PartiesTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function PartiesTable({ searchParams }: Pick<PageProps<"/parties">, "searchParams">) {
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const statusParam = firstParam(sp.status);
  const status: PartyStatus | undefined = statusParam === "ACTIVE" || statusParam === "INACTIVE" ? statusParam : undefined;
  const rows = await listParties({ q, status });

  const payable = rows.reduce((acc, r) => (D(r.balance).greaterThan(0) ? acc.plus(D(r.balance)) : acc), ZERO);
  const receivable = rows.reduce((acc, r) => (D(r.balance).isNegative() ? acc.plus(D(r.balance).abs()) : acc), ZERO);

  return (
    <>
      <FilterBar action="/parties" resetHref="/parties">
        <FilterField label="Search" htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Name, phone or contact" className="w-56" />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""} className="w-36">
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </FilterField>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q || status ? "No parties match these filters" : "No parties yet"}
          description="Add the suppliers and beoparis whose goods you sell on commission."
          action={
            <LinkButton href="/parties/new">
              <Plus /> New party
            </LinkButton>
          }
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Party</Th>
              <Th>Contact</Th>
              <Th>Phone</Th>
              <Th>Market / items</Th>
              <Th className="text-right">Commission</Th>
              <Th className="text-right">Bills</Th>
              <Th className="text-right">Balance</Th>
              <Th>Status</Th>
              <Th className="w-24 text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <Link href={`/parties/${p.id}`} className="font-medium text-primary hover:underline">
                    {p.name}
                  </Link>
                </Td>
                <Td className="text-muted-foreground">{p.contactPerson ?? "—"}</Td>
                <Td className="text-muted-foreground tabular">{p.phone ?? "—"}</Td>
                <Td className="max-w-48 truncate text-muted-foreground" title={[p.address, p.mainItems].filter(Boolean).join(" · ") || undefined}>
                  {[p.address, p.mainItems].filter(Boolean).join(" · ") || "—"}
                </Td>
                <Td className="text-right tabular">{formatPct(p.commissionRate)}</Td>
                <Td className="text-right tabular">{p.billCount}</Td>
                <Td className="text-right">
                  <Money value={D(p.balance).abs()} symbol={false} className="font-medium" />
                  <br />
                  <BalanceLabel value={p.balance} />
                </Td>
                <Td>
                  <Badge variant={p.status === "ACTIVE" ? "success" : "outline"}>{p.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/parties/${p.id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Edit ${p.name}`}>
                      <Pencil />
                    </Link>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
          <TFoot>
            <Tr>
              <Td colSpan={6} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Totals ({rows.length} parties)
              </Td>
              <Td className="text-right">
                <span className="block text-xs text-warning">
                  Payable <Money value={payable} symbol={false} />
                </span>
                <span className="block text-xs text-info">
                  Receivable <Money value={receivable} symbol={false} />
                </span>
              </Td>
              <Td colSpan={2} />
            </Tr>
          </TFoot>
        </Table>
      )}
    </>
  );
}
