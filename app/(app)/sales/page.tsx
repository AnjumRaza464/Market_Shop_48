import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, Pencil, ShoppingBag, Users } from "lucide-react";
import { Suspense } from "react";
import type { PaymentMode } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { PeriodLinks } from "@/components/filters/period-links";
import { SaleEntryForm } from "@/components/forms/sale-entry-form";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { FormSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { createSaleEntry, deleteSaleEntry } from "@/lib/actions/sales";
import { PAYMENT_MODES, paymentModeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, formatAmount, formatQty } from "@/lib/money";
import { resolvePeriod } from "@/lib/periods";
import { listCustomerOptions } from "@/lib/queries/customers";
import { listSaleEntries, listSaleItems } from "@/lib/queries/sales";
import { requestToday } from "@/lib/request";
import { firstParam, parseIntParam, qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer khata entries" };

export default function SalesPage(props: PageProps<"/sales">) {
  return (
    <>
      <PageHeader
        title="Customer Khata Entries"
        description="Goods given to customers and cash received from them – one row per entry, like the Khaata sheet."
        actions={
          <>
            <LinkButton href="/customers" variant="outline">
              <Users /> Customers
            </LinkButton>
            <LinkButton href="/reports/sales" variant="outline">
              <ChartColumn /> Sales report
            </LinkButton>
          </>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <FormSkeleton fields={6} />
            <TableSkeleton rows={8} cols={9} />
          </div>
        }
      >
        <SalesContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SalesContent({ searchParams }: Pick<PageProps<"/sales">, "searchParams">) {
  const sp = await searchParams;
  const today = await requestToday();
  const period = resolvePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) }, today, "all");
  const customerId = parseIntParam(sp.customerId);
  const item = firstParam(sp.item)?.trim() || undefined;
  const q = firstParam(sp.q)?.trim() || undefined;
  const modeParam = firstParam(sp.paymentMode);
  const paymentMode = PAYMENT_MODES.some((m) => m.value === modeParam) ? (modeParam as PaymentMode) : undefined;
  const kindParam = firstParam(sp.kind);
  const kind = kindParam === "GOODS" || kindParam === "RECEIPTS" ? kindParam : undefined;
  const page = parseIntParam(sp.page) ?? 1;

  const [result, customers, items] = await Promise.all([
    listSaleEntries({ q, customerId, item, paymentMode, kind, from: period.from, to: period.to, page }),
    listCustomerOptions(customerId),
    listSaleItems(),
  ]);
  const params = {
    period: period.key === "custom" ? undefined : period.key === "all" ? undefined : period.key,
    from: period.key === "custom" ? period.from : undefined,
    to: period.key === "custom" ? period.to : undefined,
    customerId,
    item,
    q,
    paymentMode,
    kind,
  };
  const listHref = `/sales${qs(params)}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick entry</CardTitle>
          <CardDescription>Pick the customer, type the goods line and/or the amount received, press Ctrl+Enter. The form stays ready for the next row.</CardDescription>
        </CardHeader>
        <CardContent>
          <SaleEntryForm action={createSaleEntry} customers={customers} items={items} defaultDate={today} defaultCustomerId={customerId} mode="quick" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">
            {period.label} · {result.total} entries
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="tabular">
              Goods {formatAmount(result.totals.debit)}
            </Badge>
            <Badge variant="outline" className="tabular">
              Received {formatAmount(result.totals.credit)}
            </Badge>
            <Badge variant={D(result.totals.net).greaterThan(0) ? "danger" : "success"} className="tabular">
              Net (goods − received) {formatAmount(result.totals.net)}
            </Badge>
            {!D(result.totals.qty).isZero() ? (
              <Badge variant="outline" className="tabular">
                Qty {formatQty(result.totals.qty)}
              </Badge>
            ) : null}
          </div>
        </div>
        <PeriodLinks basePath="/sales" active={period.key} params={{ customerId: customerId ? String(customerId) : undefined, item, q, paymentMode, kind }} />
      </div>

      <FilterBar action="/sales" resetHref="/sales" hidden={{ period: params.period }}>
        <FilterField label="Customer" htmlFor="customerId">
          <Select id="customerId" name="customerId" defaultValue={customerId ? String(customerId) : ""} className="w-52">
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Item" htmlFor="item">
          <Select id="item" name="item" defaultValue={item ?? ""} className="w-40">
            <option value="">All items</option>
            {items.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={kind ?? ""} className="w-36">
            <option value="">All rows</option>
            <option value="GOODS">Goods given</option>
            <option value="RECEIPTS">Cash received</option>
          </Select>
        </FilterField>
        <FilterField label="Mode" htmlFor="paymentMode">
          <Select id="paymentMode" name="paymentMode" defaultValue={paymentMode ?? ""} className="w-36">
            <option value="">Any</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={period.key === "custom" ? (period.from ?? "") : ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={period.key === "custom" ? (period.to ?? "") : ""} />
        </FilterField>
        <FilterField label="Search" htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Bill no, remarks…" className="w-44" />
        </FilterField>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState icon={<ShoppingBag />} title="No entries found" description="Use the quick entry form above to record goods given or cash received." />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Item</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Rate</Th>
                <Th className="text-right">Goods (Dr)</Th>
                <Th className="text-right">Received (Cr)</Th>
                <Th>Mode</Th>
                <Th>Ref / remarks</Th>
                <Th className="w-28 text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {result.rows.map((e) => (
                <Tr key={e.id}>
                  <Td className="whitespace-nowrap tabular">{formatDate(e.entryDate)}</Td>
                  <Td>
                    <Link href={`/customers/${e.customerId}`} className="font-medium hover:underline">
                      {e.customerName}
                    </Link>
                  </Td>
                  <Td>{e.itemName ?? <span className="text-muted-foreground">Payment</span>}</Td>
                  <Td className="text-right tabular">{e.quantity ? `${formatQty(e.quantity)} ${e.unit ?? ""}`.trim() : ""}</Td>
                  <Td className="text-right tabular">{e.rate ? formatAmount(e.rate) : ""}</Td>
                  <Td className="text-right font-medium">{D(e.amount).isZero() ? "" : <Money value={e.amount} symbol={false} />}</Td>
                  <Td className="text-right font-medium text-success">{D(e.received).isZero() ? "" : <Money value={e.received} symbol={false} />}</Td>
                  <Td className="text-muted-foreground">{e.paymentMode ? paymentModeLabel(e.paymentMode) : "—"}</Td>
                  <Td className="max-w-56 truncate text-muted-foreground" title={[e.reference, e.remarks].filter(Boolean).join(" · ") || undefined}>
                    {[e.reference, e.remarks].filter(Boolean).join(" · ") || "—"}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/sales/${e.id}/edit${qs({ returnTo: listHref })}`}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        aria-label="Edit entry"
                      >
                        <Pencil />
                      </Link>
                      <ConfirmButton action={deleteSaleEntry.bind(null, e.id)} variant="ghost" size="sm" confirmText="Delete?" confirmLabel="Yes" className="text-destructive">
                        Delete
                      </ConfirmButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={3} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Totals · {result.total} entries (all pages)
                </Td>
                <Td className="text-right tabular">{D(result.totals.qty).isZero() ? "" : formatQty(result.totals.qty)}</Td>
                <Td />
                <Td className="text-right">
                  <Money value={result.totals.debit} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={result.totals.credit} symbol={false} />
                </Td>
                <Td colSpan={3} />
              </Tr>
            </TFoot>
          </Table>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/sales" params={params} />
        </>
      )}
    </div>
  );
}
