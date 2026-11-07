import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { YearPicker } from "@/components/filters/period-links";
import { PrintButton } from "@/components/print/print-button";
import { formatLedgerBalance } from "@/components/print/statement";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { formatDate, parseDateParam, parseYearParam, REPORT_YEARS, yearRange } from "@/lib/dates";
import { D, formatMoney, sum } from "@/lib/money";
import { getPartiesSummary, type PartySummaryRow } from "@/lib/queries/parties";
import { requestYear } from "@/lib/request";
import { firstParam, qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Supplier summary" };

export default function PartySummaryPage(props: PageProps<"/reports/parties">) {
  return (
    <>
      <PageHeader
        title="Supplier Party Summary"
        description="Who holds our advances, whom we still owe, and who is settled – lifetime, or for any year / period with opening and closing balances."
        actions={<PrintButton variant="outline">Print summary</PrintButton>}
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <StatSkeleton count={4} />
            <TableSkeleton rows={6} cols={10} />
          </div>
        }
      >
        <PartySummaryContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

type Scope = { kind: "all" } | { kind: "year"; year: number } | { kind: "custom"; from?: string; to?: string };

async function PartySummaryContent({ searchParams }: Pick<PageProps<"/reports/parties">, "searchParams">) {
  const sp = await searchParams;
  const thisYear = await requestYear();
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const yearParam = firstParam(sp.year);
  let scope: Scope;
  if (from || to) scope = { kind: "custom", from, to };
  else if (yearParam === "all" || yearParam === undefined) scope = { kind: "all" };
  else scope = { kind: "year", year: parseYearParam(yearParam, thisYear) };
  const range = scope.kind === "year" ? yearRange(scope.year) : scope.kind === "custom" ? { from: scope.from, to: scope.to } : {};
  const label =
    scope.kind === "all"
      ? "All time"
      : scope.kind === "year"
        ? `Year ${scope.year}`
        : `${range.from ? formatDate(range.from) : "Start"} – ${range.to ? formatDate(range.to) : "Today"}`;

  const rows = await getPartiesSummary(range);
  const receivable = rows.filter((r) => D(r.balance).isNegative());
  const payable = rows.filter((r) => D(r.balance).greaterThan(0));
  const settled = rows.filter((r) => D(r.balance).isZero());

  const totalPayable = sum(payable.map((r) => r.balance));
  const totalReceivable = sum(receivable.map((r) => D(r.balance).abs()));
  const net = totalPayable.minus(totalReceivable);
  const periodTotals = {
    gross: sum(rows.map((r) => r.gross)),
    commission: sum(rows.map((r) => r.commission)),
    bills: rows.reduce((a, r) => a + r.billCount, 0),
  };

  if (rows.length === 0) {
    return <EmptyState title="No parties yet" description="Add parties and record bills to see their positions here." />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/reports/parties"
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${scope.kind === "all" ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}
          >
            All time
          </Link>
          <YearPicker basePath="/reports/parties" years={REPORT_YEARS} active={scope.kind === "year" ? scope.year : 0} />
        </div>
        <FilterBar action="/reports/parties" resetHref="/reports/parties" className="mb-0">
          <FilterField label="From" htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
          </FilterField>
          <FilterField label="To" htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
          </FilterField>
        </FilterBar>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`Payable to parties${scope.kind === "all" ? "" : " (closing)"}`} value={formatMoney(totalPayable)} hint={`${payable.length} parties we owe · ${label}`} tone="warning" />
        <StatTile label={`Advances with parties${scope.kind === "all" ? "" : " (closing)"}`} value={formatMoney(totalReceivable)} hint={`${receivable.length} parties owe us`} tone="info" />
        <StatTile
          label={net.isNegative() ? "Net receivable" : "Net payable"}
          value={formatMoney(net.abs())}
          hint="Payable − advances"
          tone={net.isNegative() ? "info" : "warning"}
        />
        <StatTile label={`Gross sale · ${label}`} value={formatMoney(periodTotals.gross)} hint={`${periodTotals.bills} bills · commission ${formatMoney(periodTotals.commission)}`} tone="success" />
      </div>

      <SummarySection
        title="Parties holding advances (receivable)"
        description="Money given in advance that is yet to be recovered through pattis."
        rows={receivable}
        tone="info"
        showOpening={scope.kind !== "all"}
        range={range}
      />
      <SummarySection
        title="Parties we owe (payable)"
        description="Net patti amounts not yet paid out."
        rows={payable}
        tone="warning"
        showOpening={scope.kind !== "all"}
        range={range}
      />
      <SummarySection title="Settled parties" description="Zero balance." rows={settled} tone="default" showOpening={scope.kind !== "all"} range={range} />
    </div>
  );
}

function SummarySection({
  title,
  description,
  rows,
  tone,
  showOpening,
  range,
}: {
  title: string;
  description: string;
  rows: PartySummaryRow[];
  tone: "info" | "warning" | "default";
  showOpening: boolean;
  range: { from?: string; to?: string };
}) {
  const totals = {
    gross: sum(rows.map((r) => r.gross)),
    commission: sum(rows.map((r) => r.commission)),
    expenses: sum(rows.map((r) => r.expenses)),
    net: sum(rows.map((r) => r.net)),
    payments: sum(rows.map((r) => r.payments)),
    advances: sum(rows.map((r) => r.advances)),
    balance: sum(rows.map((r) => D(r.balance).abs())),
  };

  return (
    <section className="print-break-inside-avoid">
      <div className="mb-3">
        <h2 className="text-base font-semibold">
          {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">None.</p>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Party</Th>
              {showOpening ? <Th className="text-right">Opening</Th> : null}
              <Th className="text-right">Bills</Th>
              <Th className="text-right">Gross sold</Th>
              <Th className="text-right">Commission</Th>
              <Th className="text-right">Expenses</Th>
              <Th className="text-right">Net credited</Th>
              <Th className="text-right">Paid out</Th>
              <Th className="text-right">Advances</Th>
              <Th className="text-right">{showOpening ? "Closing" : "Balance"}</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Link href={`/parties/${r.id}${qs(range)}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  {r.status === "INACTIVE" ? (
                    <Badge variant="outline" className="ml-2">
                      Inactive
                    </Badge>
                  ) : null}
                </Td>
                {showOpening ? <Td className="text-right tabular text-muted-foreground">{formatLedgerBalance(r.openingBalance)}</Td> : null}
                <Td className="text-right tabular">{r.billCount}</Td>
                <Td className="text-right">
                  <Money value={r.gross} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={r.commission} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={r.expenses} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={r.net} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={r.payments} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={r.advances} symbol={false} />
                </Td>
                <Td className={`text-right font-semibold ${tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : ""}`}>
                  <Money value={D(r.balance).abs()} symbol={false} />
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{D(r.balance).isNegative() ? "Dr" : D(r.balance).isZero() ? "" : "Cr"}</span>
                </Td>
              </Tr>
            ))}
          </TBody>
          <TFoot>
            <Tr>
              <Td colSpan={showOpening ? 2 : 1}>Total</Td>
              <Td className="text-right tabular">{rows.reduce((a, r) => a + r.billCount, 0)}</Td>
              <Td className="text-right">
                <Money value={totals.gross} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.commission} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.expenses} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.net} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.payments} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.advances} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.balance} symbol={false} />
              </Td>
            </Tr>
          </TFoot>
        </Table>
      )}
    </section>
  );
}
