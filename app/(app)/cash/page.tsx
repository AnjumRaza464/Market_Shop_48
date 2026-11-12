import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark, Pencil, PiggyBank, Wallet } from "lucide-react";
import { Suspense } from "react";
import type { PaymentMode } from "@/db/schema";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { PeriodLinks } from "@/components/filters/period-links";
import { CashEntryForm } from "@/components/forms/cash-entry-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { FormSkeleton, StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { createCashEntry, deleteCashEntry } from "@/lib/actions/cash";
import { CASH_SOURCES, CASH_SOURCE_VALUES, EXPENSE_CATEGORIES, PAYMENT_MODES, labelFor, paymentModeLabel, type CashSource } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { D, formatMoney } from "@/lib/money";
import { resolvePeriod } from "@/lib/periods";
import { getCashFlowSummary, getCashPosition, listCashBook, type CashBookRow } from "@/lib/queries/cash";
import { listPartnerOptions } from "@/lib/queries/partners";
import { requestToday } from "@/lib/request";
import { billNumber, firstParam, parseIntParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Cash in hand" };

export default function CashPage(props: PageProps<"/cash">) {
  return (
    <>
      <PageHeader
        title="Cash in Hand"
        description="Nakdi ka hisaab – every rupee received from customers and suppliers comes in, every payment, advance and shop expense goes out. The balance is worked out from the khatas, so it never needs re-typing."
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <StatSkeleton count={4} />
            <FormSkeleton fields={6} />
            <TableSkeleton rows={8} cols={8} />
          </div>
        }
      >
        <CashContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const sourceBadge: Record<CashSource, "success" | "danger" | "info" | "warning" | "primary" | "default" | "outline"> = {
  CUSTOMER_RECEIPT: "success",
  PARTY_RECEIPT: "success",
  OPENING: "primary",
  DEPOSIT: "info",
  TRANSFER_IN: "outline",
  PARTY_PAYMENT: "danger",
  PARTY_ADVANCE: "warning",
  EXPENSE: "danger",
  WITHDRAWAL: "warning",
  TRANSFER_OUT: "outline",
  ADJUSTMENT: "default",
};

function RowSubject({ row }: { row: CashBookRow }) {
  switch (row.source) {
    case "CUSTOMER_RECEIPT":
      return row.whoId ? (
        <Link href={`/customers/${row.whoId}`} className="font-medium hover:underline">
          {row.who}
        </Link>
      ) : (
        <span>{row.who}</span>
      );
    case "PARTY_RECEIPT":
    case "PARTY_PAYMENT":
    case "PARTY_ADVANCE":
      return row.whoId ? (
        <Link href={`/parties/${row.whoId}`} className="font-medium hover:underline">
          {row.who}
        </Link>
      ) : (
        <span>{row.who}</span>
      );
    case "EXPENSE":
      return (
        <Link href={`/expenses/${row.sourceId}/edit`} className="font-medium hover:underline">
          {labelFor(EXPENSE_CATEGORIES, row.who as (typeof EXPENSE_CATEGORIES)[number]["value"])}
        </Link>
      );
    default:
      return <span className="font-medium">{row.who ?? "Shop"}</span>;
  }
}

async function CashContent({ searchParams }: Pick<PageProps<"/cash">, "searchParams">) {
  const sp = await searchParams;
  const today = await requestToday();
  const period = resolvePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) }, today);
  const modeParam = firstParam(sp.mode);
  const mode = PAYMENT_MODES.some((m) => m.value === modeParam) ? (modeParam as PaymentMode) : undefined;
  const sourceParam = firstParam(sp.source);
  const source = CASH_SOURCE_VALUES.some((s) => s === sourceParam) ? (sourceParam as CashSource) : undefined;
  const page = parseIntParam(sp.page) ?? 1;

  const [position, flow, book, partners] = await Promise.all([
    getCashPosition(),
    getCashFlowSummary({ from: period.from, to: period.to, mode }),
    listCashBook({ from: period.from, to: period.to, mode, source, page }),
    listPartnerOptions(),
  ]);

  const params = {
    period: period.key === "custom" ? undefined : period.key,
    from: period.key === "custom" ? period.from : undefined,
    to: period.key === "custom" ? period.to : undefined,
    mode,
    source,
  };
  const cash = D(position.cashInHand);
  const net = D(flow.net);
  const inSources = flow.bySource.filter((s) => D(s.cashIn).greaterThan(0));
  const outSources = flow.bySource.filter((s) => D(s.cashOut).greaterThan(0));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Right now · all entries to date</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Cash in hand"
            value={formatMoney(position.cashInHand)}
            hint={
              position.hasOpening
                ? "Physical cash in the shop (Cash mode only)"
                : "No opening cash recorded yet – add an “Opening cash” entry below so this matches your cash box"
            }
            icon={<Wallet />}
            tone={cash.isNegative() ? "danger" : "success"}
          />
          <StatTile label="Bank & digital" value={formatMoney(position.bankAndDigital)} hint="Bank, JazzCash, Easypaisa, cheque, other" icon={<Landmark />} tone="info" />
          <StatTile label="Total funds" value={formatMoney(position.total)} hint="Cash + bank & digital" icon={<PiggyBank />} />
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">By account</p>
            <ul className="mt-2 space-y-1 text-sm">
              {position.byMode
                .filter((m) => !D(m.balance).isZero() || m.mode === "CASH")
                .map((m) => (
                  <li key={m.mode} className="flex items-center justify-between gap-2">
                    <Link href={`/cash?mode=${m.mode}&period=${params.period ?? "month"}`} className="text-muted-foreground hover:text-foreground hover:underline">
                      {paymentModeLabel(m.mode)}
                    </Link>
                    <Money value={m.balance} symbol={false} colorize className="font-medium" />
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Manual cash entry</CardTitle>
          <CardDescription>
            Only for money that is not already in a khata: opening cash, money you put in or take out, bank deposits/withdrawals and counting corrections.
            Customer receipts, supplier payments and shop expenses are picked up automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashEntryForm action={createCashEntry} defaultDate={today} partners={partners} mode="quick" defaultType={position.hasOpening ? "DEPOSIT" : "OPENING"} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          Cash book · {period.label}
          {mode ? <span className="ml-2 text-sm font-normal text-muted-foreground">· {paymentModeLabel(mode)} only</span> : null}
        </h2>
        <PeriodLinks basePath="/cash" active={period.key} params={{ mode, source }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Opening balance" value={formatMoney(flow.opening)} hint={period.from ? `Before ${formatDate(period.from)}` : "All time – no opening"} icon={<Banknote />} />
        <StatTile label="Cash in" value={formatMoney(flow.cashIn)} hint={inSources.map((s) => `${s.label} ${formatMoney(s.cashIn, { symbol: false })}`).join(" · ") || "Nothing received"} icon={<ArrowDownLeft />} tone="success" />
        <StatTile label="Cash out" value={formatMoney(flow.cashOut)} hint={outSources.map((s) => `${s.label} ${formatMoney(s.cashOut, { symbol: false })}`).join(" · ") || "Nothing paid"} icon={<ArrowUpRight />} tone="danger" />
        <StatTile
          label="Closing balance"
          value={formatMoney(flow.closing)}
          hint={`Net ${net.isNegative() ? "−" : "+"}${formatMoney(net.abs(), { symbol: false })} in this period`}
          icon={<Wallet />}
          tone={D(flow.closing).isNegative() ? "danger" : "default"}
        />
      </div>

      <FilterBar action="/cash" resetHref="/cash" hidden={{ period: params.period }}>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={period.key === "custom" ? (period.from ?? "") : ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={period.key === "custom" ? (period.to ?? "") : ""} />
        </FilterField>
        <FilterField label="Account" htmlFor="mode">
          <Select id="mode" name="mode" defaultValue={mode ?? ""} className="w-40">
            <option value="">All accounts</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type" htmlFor="source">
          <Select id="source" name="source" defaultValue={source ?? ""} className="w-52">
            <option value="">All movements</option>
            {CASH_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {book.rows.length === 0 ? (
        <EmptyState icon={<Wallet />} title="No cash movement in this period" description="Receipts, payments and expenses you record elsewhere will show up here automatically." />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th>Movement</Th>
                <Th>Party / detail</Th>
                <Th>Ref</Th>
                <Th>Account</Th>
                <Th className="text-right">In</Th>
                <Th className="text-right">Out</Th>
                <Th className="text-right">Balance</Th>
                <Th className="w-28 text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {book.page === 1 ? (
                <Tr className="bg-muted/30">
                  <Td className="whitespace-nowrap tabular text-muted-foreground">{period.from ? formatDate(period.from) : "—"}</Td>
                  <Td colSpan={6} className="text-xs uppercase tracking-wide text-muted-foreground">
                    Opening balance{source ? " (filtered)" : ""}
                  </Td>
                  <Td className="text-right font-medium">
                    <Money value={book.opening} symbol={false} colorize />
                  </Td>
                  <Td />
                </Tr>
              ) : null}
              {book.rows.map((r) => {
                const manual = ["OPENING", "DEPOSIT", "WITHDRAWAL", "TRANSFER_OUT", "TRANSFER_IN", "ADJUSTMENT"].includes(r.source);
                return (
                  <Tr key={`${r.source}-${r.sourceId}`}>
                    <Td className="whitespace-nowrap tabular">{formatDate(r.date)}</Td>
                    <Td>
                      <Badge variant={sourceBadge[r.source]}>{labelFor(CASH_SOURCES, r.source)}</Badge>
                    </Td>
                    <Td className="max-w-80">
                      <div className="truncate">
                        <RowSubject row={r} />
                      </div>
                      {r.note ? (
                        <p className="truncate text-xs text-muted-foreground" title={r.note}>
                          {r.note}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="tabular">
                      {r.billId ? (
                        <Link href={`/bills/${r.billId}`} className="text-primary hover:underline">
                          {billNumber(r.billId)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{paymentModeLabel(r.mode)}</Td>
                    <Td className="text-right text-success">{D(r.cashIn).greaterThan(0) ? <Money value={r.cashIn} symbol={false} /> : null}</Td>
                    <Td className="text-right text-destructive">{D(r.cashOut).greaterThan(0) ? <Money value={r.cashOut} symbol={false} /> : null}</Td>
                    <Td className="text-right font-medium">
                      <Money value={r.balance} symbol={false} colorize />
                    </Td>
                    <Td className="text-right">
                      {manual ? (
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/cash/${r.sourceId}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Edit cash entry">
                            <Pencil />
                          </Link>
                          <ConfirmButton action={deleteCashEntry.bind(null, r.sourceId)} variant="ghost" size="sm" confirmText="Delete?" confirmLabel="Yes" className="text-destructive">
                            Delete
                          </ConfirmButton>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">via khata</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={5} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Totals · {book.total} movement(s) · closing
                </Td>
                <Td className="text-right">
                  <Money value={book.totals.cashIn} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={book.totals.cashOut} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={book.closing} symbol={false} colorize />
                </Td>
                <Td />
              </Tr>
            </TFoot>
          </Table>
          <Pagination page={book.page} pageSize={book.pageSize} total={book.total} basePath="/cash" params={params} />
        </>
      )}
    </div>
  );
}
