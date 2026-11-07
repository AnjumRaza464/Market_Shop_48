import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Plus, Printer } from "lucide-react";
import { Suspense } from "react";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { SaleEntryForm } from "@/components/forms/sale-entry-form";
import { CustomerStatementDocument } from "@/components/print/customer-statement";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDueBalance } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { createSaleEntry } from "@/lib/actions/sales";
import { formatDate, parseDateParam } from "@/lib/dates";
import { D, formatMoney, formatQty } from "@/lib/money";
import { getCustomerLedger, listCustomerOptions } from "@/lib/queries/customers";
import { listSaleItems } from "@/lib/queries/sales";
import { requestToday } from "@/lib/request";
import { qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer khata" };

export default function CustomerPage(props: PageProps<"/customers/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <StatSkeleton count={4} />
          <TableSkeleton rows={8} />
        </div>
      }
    >
      <CustomerLedgerContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CustomerLedgerContent({ params, searchParams }: Pick<PageProps<"/customers/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const [ledger, today, customerOptions, items] = await Promise.all([
    getCustomerLedger(customerId, { from, to }),
    requestToday(),
    listCustomerOptions(customerId),
    listSaleItems(),
  ]);
  if (!ledger) notFound();
  const { customer } = ledger;
  const balance = D(ledger.lifetime.balance);

  return (
    <>
      <PageHeader
        backHref="/customers"
        backLabel="Customers"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {customer.name}
            <Badge variant={customer.status === "ACTIVE" ? "success" : "outline"}>{customer.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
          </span>
        }
        description={[customer.contactPerson, customer.phone, customer.city].filter(Boolean).join(" · ") || "Customer khata"}
        actions={
          <>
            <LinkButton href={`/print/customers/${customer.id}${qs({ from, to })}`} variant="outline">
              <Printer /> Print khata
            </LinkButton>
            <LinkButton href={`/customers/${customer.id}/edit`} variant="outline">
              <Pencil /> Edit
            </LinkButton>
            <LinkButton href={`/sales?customerId=${customer.id}`}>
              <Plus /> All entries
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={balance.isZero() ? "Balance" : balance.greaterThan(0) ? "Due from customer" : "Advance from customer"}
          value={formatMoney(balance.abs())}
          hint={`${formatDueBalance(ledger.lifetime.balance)} · opening ${formatDueBalance(customer.openingBalance)}`}
          tone={balance.isZero() ? "default" : balance.greaterThan(0) ? "danger" : "info"}
        />
        <StatTile
          label="Goods given"
          value={formatMoney(ledger.totals.debit)}
          hint={`${ledger.totals.goodsRows} goods row(s) · ${formatQty(ledger.totals.qty)} qty${from || to ? " in period" : ""}`}
        />
        <StatTile label="Cash received" value={formatMoney(ledger.totals.credit)} hint={`${ledger.totals.receiptRows} receipt(s)${from || to ? " in period" : ""}`} tone="success" />
        <StatTile
          label="Last entry"
          value={ledger.lifetime.lastEntry ? formatDate(ledger.lifetime.lastEntry) : "—"}
          hint={`${ledger.lifetime.entries} entries in total`}
        />
      </div>

      <Card className="mb-6 no-print">
        <CardHeader>
          <CardTitle>Quick entry for {customer.name}</CardTitle>
          <CardDescription>Goods given and/or cash received – the balance updates immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <SaleEntryForm action={createSaleEntry} customers={customerOptions} items={items} defaultDate={today} defaultCustomerId={customer.id} mode="quick" />
        </CardContent>
      </Card>

      <FilterBar action={`/customers/${customer.id}`} resetHref={`/customers/${customer.id}`}>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
        </FilterField>
      </FilterBar>

      <CustomerStatementDocument ledger={ledger} />
    </>
  );
}
