import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, Pencil, UsersRound, Wallet } from "lucide-react";
import { Suspense } from "react";
import type { ExpenseCategory, PaymentMode } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { PeriodLinks } from "@/components/filters/period-links";
import { ExpenseForm } from "@/components/forms/expense-form";
import { PartnerSettlementTable } from "@/components/reports/partner-settlement";
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
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, PAYMENT_MODES, labelFor, paymentModeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, formatMoney } from "@/lib/money";
import { resolvePeriod } from "@/lib/periods";
import { getExpenseTotal, listExpenses, previousRange } from "@/lib/queries/expenses";
import { getPartnerSettlement, listPartnerOptions } from "@/lib/queries/partners";
import { requestToday } from "@/lib/request";
import { firstParam, parseIntParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Shop expenses" };

export default function ExpensesPage(props: PageProps<"/expenses">) {
  return (
    <>
      <PageHeader
        title="Shop Expenses"
        description="Dukaan ke akhrajaat – rent, electricity, tea, salaries and everything else that runs the shop."
        actions={
          <>
            <LinkButton href="/partners" variant="outline">
              <UsersRound /> Partners
            </LinkButton>
            <LinkButton href="/reports/expenses" variant="outline">
              <ChartColumn /> Expense reports
            </LinkButton>
          </>
        }
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <FormSkeleton fields={6} />
            <TableSkeleton rows={8} cols={7} />
          </div>
        }
      >
        <ExpensesContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ExpensesContent({ searchParams }: Pick<PageProps<"/expenses">, "searchParams">) {
  const sp = await searchParams;
  const today = await requestToday();
  const period = resolvePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) }, today);
  const categoryParam = firstParam(sp.category);
  const category = EXPENSE_CATEGORIES.some((c) => c.value === categoryParam) ? (categoryParam as ExpenseCategory) : undefined;
  const modeParam = firstParam(sp.paymentMode);
  const paymentMode = PAYMENT_MODES.some((m) => m.value === modeParam) ? (modeParam as PaymentMode) : undefined;
  const paidByParam = firstParam(sp.paidBy);
  const paidBy: number | "SHOP" | undefined = paidByParam === "SHOP" ? "SHOP" : parseIntParam(sp.paidBy);
  const page = parseIntParam(sp.page) ?? 1;

  const prev = period.from && period.to ? previousRange(period.from, period.to) : undefined;
  const [result, partners, settlement, previous] = await Promise.all([
    listExpenses({ from: period.from, to: period.to, category, paymentMode, paidBy, page }),
    listPartnerOptions(),
    getPartnerSettlement({ from: period.from, to: period.to, category, paymentMode }),
    prev ? getExpenseTotal({ from: prev.from, to: prev.to, category, paymentMode, paidBy }) : Promise.resolve(undefined),
  ]);
  const prevTotal = previous ? D(previous.total) : undefined;
  const changePct = prevTotal && !prevTotal.isZero() ? D(result.sumAmount).minus(prevTotal).dividedBy(prevTotal).times(100) : undefined;
  const params = {
    period: period.key === "custom" ? undefined : period.key,
    from: period.key === "custom" ? period.from : undefined,
    to: period.key === "custom" ? period.to : undefined,
    category,
    paymentMode,
    paidBy: paidBy === undefined ? undefined : String(paidBy),
  };
  const grandTotal = D(result.sumAmount);
  const biggest = result.byCategory.reduce<(typeof result.byCategory)[number] | undefined>(
    (best, c) => (!best || D(c.total).greaterThan(D(best.total)) ? c : best),
    undefined,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quick entry</CardTitle>
          <CardDescription>Enter moves to the next field · Ctrl+Enter saves · the form stays ready for the next expense.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseForm action={createExpense} defaultDate={today} partners={partners} mode="quick" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{period.label}</h2>
        <PeriodLinks basePath="/expenses" active={period.key} params={{ category, paymentMode, paidBy: params.paidBy }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total expense" value={formatMoney(grandTotal)} hint={`${result.total} entries`} tone="danger" />
        <StatTile
          label="Daily average"
          value={period.from && period.to ? formatMoney(result.dailyAverage) : "—"}
          hint={
            prev && previous
              ? `vs previous period ${formatMoney(previous.total)}${changePct ? ` (${changePct.greaterThan(0) ? "+" : ""}${changePct.toFixed(0)}%)` : ""} · ${formatDate(prev.from)} – ${formatDate(prev.to)}`
              : "Pick a bounded period to compare"
          }
        />
        <StatTile label="Biggest category" value={biggest ? labelFor(EXPENSE_CATEGORIES, biggest.category) : "—"} hint={biggest ? `${formatMoney(biggest.total)} · ${grandTotal.isZero() ? 0 : D(biggest.total).dividedBy(grandTotal).times(100).toFixed(0)}% of total` : ""} />
        <StatTile label="Paid from shop cash box" value={formatMoney(settlement.shopCashBox)} hint={settlement.rows.length ? `Partners paid ${formatMoney(D(settlement.total).minus(D(settlement.shopCashBox)))}` : "No partners defined"} />
      </div>

      {result.byCategory.length ? (
        <div className="flex flex-wrap gap-1.5">
          {result.byCategory.map((c) => (
            <Badge key={c.category} variant="outline" className="tabular">
              {labelFor(EXPENSE_CATEGORIES, c.category)} · {formatMoney(c.total, { symbol: false })} ({c.entries})
            </Badge>
          ))}
        </div>
      ) : null}

      <FilterBar action="/expenses" resetHref="/expenses" hidden={{ period: params.period }}>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={period.key === "custom" ? (period.from ?? "") : ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={period.key === "custom" ? (period.to ?? "") : ""} />
        </FilterField>
        <FilterField label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue={category ?? ""} className="w-48">
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Paid by" htmlFor="paidBy">
          <Select id="paidBy" name="paidBy" defaultValue={params.paidBy ?? ""} className="w-40">
            <option value="">Anyone</option>
            <option value="SHOP">Shop cash box</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
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
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState icon={<Wallet />} title="No expenses in this period" description="Use the quick entry form above to record one." />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th>Category</Th>
                <Th>Description</Th>
                <Th>Paid by</Th>
                <Th>Mode</Th>
                <Th className="text-right">Amount</Th>
                <Th className="w-32 text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {result.rows.map((e) => (
                <Tr key={e.id}>
                  <Td className="whitespace-nowrap tabular">{formatDate(e.expenseDate)}</Td>
                  <Td>
                    <Badge variant="outline">{labelFor(EXPENSE_CATEGORIES, e.category)}</Badge>
                  </Td>
                  <Td className="max-w-80 truncate text-muted-foreground" title={e.notes ?? undefined}>
                    {e.notes ?? "—"}
                  </Td>
                  <Td className="text-muted-foreground">{e.partnerName ?? "Shop cash box"}</Td>
                  <Td className="text-muted-foreground">{paymentModeLabel(e.paymentMode)}</Td>
                  <Td className="text-right font-medium">
                    <Money value={e.amount} symbol={false} />
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/expenses/${e.id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Edit expense">
                        <Pencil />
                      </Link>
                      <ConfirmButton action={deleteExpense.bind(null, e.id)} variant="ghost" size="sm" confirmText="Delete?" confirmLabel="Yes" className="text-destructive">
                        Delete
                      </ConfirmButton>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={5} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Total · {result.total} entries
                </Td>
                <Td className="text-right">
                  <Money value={result.sumAmount} symbol={false} />
                </Td>
                <Td />
              </Tr>
            </TFoot>
          </Table>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/expenses" params={params} />
        </>
      )}

      <section className="print-break-inside-avoid">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Partner settlement · {period.label}</h2>
          <p className="text-sm text-muted-foreground">Who paid more than their share of the expenses shown above (the “Paid by” filter is ignored here so the split stays fair).</p>
        </div>
        <PartnerSettlementTable settlement={settlement} periodLabel={period.label} />
      </section>
    </div>
  );
}
