import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, ShoppingBag, Users } from "lucide-react";
import { Suspense } from "react";
import type { PartyStatus } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { DueLabel, Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { CUSTOMER_POSITIONS, type CustomerPosition } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, sum, ZERO } from "@/lib/money";
import { listCustomers } from "@/lib/queries/customers";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage(props: PageProps<"/customers">) {
  return (
    <>
      <PageHeader
        title="Customers (Khareedar)"
        description="Parties you supply goods to. Each row shows goods given, cash received and what is still due."
        actions={
          <>
            <LinkButton href="/sales" variant="outline">
              <ShoppingBag /> Khata entries
            </LinkButton>
            <LinkButton href="/customers/new">
              <Plus /> New customer
            </LinkButton>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton rows={8} cols={9} />}>
        <CustomersTable searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CustomersTable({ searchParams }: Pick<PageProps<"/customers">, "searchParams">) {
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const statusParam = firstParam(sp.status);
  const status: PartyStatus | undefined = statusParam === "ACTIVE" || statusParam === "INACTIVE" ? statusParam : undefined;
  const positionParam = firstParam(sp.position);
  const position = CUSTOMER_POSITIONS.some((p) => p.value === positionParam) ? (positionParam as CustomerPosition) : undefined;
  const rows = await listCustomers({ q, status, position });

  const totals = {
    opening: sum(rows.map((r) => r.openingBalance)),
    debit: sum(rows.map((r) => r.totalDebit)),
    credit: sum(rows.map((r) => r.totalCredit)),
    due: rows.reduce((acc, r) => (D(r.balance).greaterThan(0) ? acc.plus(D(r.balance)) : acc), ZERO),
    advance: rows.reduce((acc, r) => (D(r.balance).isNegative() ? acc.plus(D(r.balance).abs()) : acc), ZERO),
  };

  return (
    <>
      <FilterBar action="/customers" resetHref="/customers">
        <FilterField label="Search" htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Name, phone or city" className="w-56" />
        </FilterField>
        <FilterField label="Position" htmlFor="position">
          <Select id="position" name="position" defaultValue={position ?? ""} className="w-44">
            <option value="">All</option>
            {CUSTOMER_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
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
          title={q || status || position ? "No customers match these filters" : "No customers yet"}
          description="Add the buyers and retailers you supply goods to on udhaar."
          action={
            <LinkButton href="/customers/new">
              <Plus /> New customer
            </LinkButton>
          }
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Customer</Th>
              <Th>Phone</Th>
              <Th>Mandi / city</Th>
              <Th className="text-right">Opening</Th>
              <Th className="text-right">Goods given</Th>
              <Th className="text-right">Received</Th>
              <Th className="text-right">Balance</Th>
              <Th>Last entry</Th>
              <Th className="text-right">Entries</Th>
              <Th className="w-20 text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((c) => (
              <Tr key={c.id} className={c.status === "INACTIVE" ? "text-muted-foreground" : undefined}>
                <Td>
                  <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                  {c.status === "INACTIVE" ? (
                    <Badge variant="outline" className="ml-2">
                      Inactive
                    </Badge>
                  ) : null}
                  {c.contactPerson ? <span className="block text-xs text-muted-foreground">{c.contactPerson}</span> : null}
                </Td>
                <Td className="text-muted-foreground tabular">{c.phone ?? "—"}</Td>
                <Td className="text-muted-foreground">{c.city ?? "—"}</Td>
                <Td className="text-right">
                  <Money value={c.openingBalance} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={c.totalDebit} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={c.totalCredit} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={D(c.balance).abs()} symbol={false} className="font-medium" />
                  <br />
                  <DueLabel value={c.balance} />
                </Td>
                <Td className="whitespace-nowrap tabular text-muted-foreground">{c.lastEntry ? formatDate(c.lastEntry) : "—"}</Td>
                <Td className="text-right tabular">{c.entryCount}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/sales?customerId=${c.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Entries of ${c.name}`}>
                      <ShoppingBag />
                    </Link>
                    <Link href={`/customers/${c.id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Edit ${c.name}`}>
                      <Pencil />
                    </Link>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
          <TFoot>
            <Tr>
              <Td colSpan={3} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                Totals ({rows.length} customers)
              </Td>
              <Td className="text-right">
                <Money value={totals.opening} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.debit} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.credit} symbol={false} />
              </Td>
              <Td className="text-right">
                <span className="block text-xs text-destructive">
                  Due <Money value={totals.due} symbol={false} />
                </span>
                <span className="block text-xs text-info">
                  Advance <Money value={totals.advance} symbol={false} />
                </span>
              </Td>
              <Td colSpan={3} />
            </Tr>
          </TFoot>
        </Table>
      )}
    </>
  );
}
