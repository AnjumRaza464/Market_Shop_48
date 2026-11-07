import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { YearPicker } from "@/components/filters/period-links";
import { PrintButton } from "@/components/print/print-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { MONTHS_LONG, MONTHS_SHORT, REPORT_YEARS, parseYearParam } from "@/lib/dates";
import { D, formatMoney, sum } from "@/lib/money";
import { getMonthlyProfit, getYearlyProfit } from "@/lib/queries/reports";
import { requestYear } from "@/lib/request";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Profit & loss" };

export default function ProfitReportPage(props: PageProps<"/reports">) {
  return (
    <>
      <PageHeader
        title="Profit & Loss"
        description="Consolidated statement: commission earned on pattis minus shop expenses, month-wise and year-wise."
        actions={<PrintButton variant="outline">Print report</PrintButton>}
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <StatSkeleton count={4} />
            <CardSkeleton />
            <TableSkeleton rows={12} cols={7} />
          </div>
        }
      >
        <ProfitReportContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ProfitReportContent({ searchParams }: Pick<PageProps<"/reports">, "searchParams">) {
  const sp = await searchParams;
  const thisYear = await requestYear();
  const year = parseYearParam(sp.year, Math.min(Math.max(thisYear, REPORT_YEARS[0]), REPORT_YEARS[REPORT_YEARS.length - 1]));
  const [monthly, yearly] = await Promise.all([getMonthlyProfit(year), getYearlyProfit()]);

  const totals = {
    billCount: monthly.reduce((a, m) => a + m.billCount, 0),
    gross: sum(monthly.map((m) => m.gross)),
    commission: sum(monthly.map((m) => m.commission)),
    billExpenses: sum(monthly.map((m) => m.billExpenses)),
    shopExpenses: sum(monthly.map((m) => m.shopExpenses)),
    profit: sum(monthly.map((m) => m.profit)),
  };
  const bestMonth = monthly.reduce((best, m) => (D(m.profit).greaterThan(D(best.profit)) ? m : best), monthly[0]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Financial year {year}</h2>
        <YearPicker basePath="/reports" years={REPORT_YEARS} active={year} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Gross sales" value={formatMoney(totals.gross)} hint={`${totals.billCount} bills settled`} />
        <StatTile label="Commission earned" value={formatMoney(totals.commission)} hint="Shop revenue" tone="success" />
        <StatTile label="Shop expenses" value={formatMoney(totals.shopExpenses)} hint="Operating overheads" tone="danger" />
        <StatTile
          label={totals.profit.isNegative() ? "Net loss" : "Net profit"}
          value={formatMoney(totals.profit.abs())}
          hint={totals.billCount ? `Best month: ${MONTHS_LONG[bestMonth.month - 1]} (${formatMoney(bestMonth.profit)})` : "No activity yet"}
          tone={totals.profit.isNegative() ? "danger" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission vs shop expenses · {year}</CardTitle>
          <CardDescription>Monthly revenue against overheads. Hover a month for exact figures.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            ariaLabel={`Monthly commission and shop expenses for ${year}`}
            series={[
              { name: "Commission", color: "#2a78d6" },
              { name: "Shop expenses", color: "#eb6834" },
            ]}
            groups={monthly.map((m) => ({ label: MONTHS_SHORT[m.month - 1], values: [Number(m.commission), Number(m.shopExpenses)] }))}
          />
        </CardContent>
      </Card>

      <section>
        <h3 className="mb-3 text-base font-semibold">Month-wise statement · {year}</h3>
        <Table>
          <THead>
            <Tr>
              <Th>Month</Th>
              <Th className="text-right">Bills</Th>
              <Th className="text-right">Gross sales</Th>
              <Th className="text-right">Commission earned</Th>
              <Th className="text-right">Kiraya</Th>
              <Th className="text-right">Mazdoori</Th>
              <Th className="text-right">Other gari exp.</Th>
              <Th className="text-right">Gari expenses total</Th>
              <Th className="text-right">Shop expenses</Th>
              <Th className="text-right">Profit / loss</Th>
            </Tr>
          </THead>
          <TBody>
            {monthly.map((m) => {
              const profit = D(m.profit);
              return (
                <Tr key={m.month}>
                  <Td className="font-medium">{MONTHS_LONG[m.month - 1]}</Td>
                  <Td className="text-right tabular">{m.billCount}</Td>
                  <Td className="text-right">
                    <Money value={m.gross} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={m.commission} symbol={false} />
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    <Money value={m.freight} symbol={false} />
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    <Money value={m.labour} symbol={false} />
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    <Money value={m.otherBillExpenses} symbol={false} />
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    <Money value={m.billExpenses} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={m.shopExpenses} symbol={false} />
                  </Td>
                  <Td className={cn("text-right font-semibold", profit.isNegative() ? "text-destructive" : profit.greaterThan(0) ? "text-success" : "")}>
                    <Money value={m.profit} symbol={false} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
          <TFoot>
            <Tr>
              <Td>Total {year}</Td>
              <Td className="text-right tabular">{totals.billCount}</Td>
              <Td className="text-right">
                <Money value={totals.gross} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.commission} symbol={false} />
              </Td>
              <Td className="text-right text-muted-foreground">
                <Money value={sum(monthly.map((m) => m.freight))} symbol={false} />
              </Td>
              <Td className="text-right text-muted-foreground">
                <Money value={sum(monthly.map((m) => m.labour))} symbol={false} />
              </Td>
              <Td className="text-right text-muted-foreground">
                <Money value={sum(monthly.map((m) => m.otherBillExpenses))} symbol={false} />
              </Td>
              <Td className="text-right text-muted-foreground">
                <Money value={totals.billExpenses} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={totals.shopExpenses} symbol={false} />
              </Td>
              <Td className={cn("text-right", totals.profit.isNegative() ? "text-destructive" : "text-success")}>
                <Money value={totals.profit} symbol={false} />
              </Td>
            </Tr>
          </TFoot>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Gari expenses (kiraya, mazdoori, market fee, munshiyana, other) are deducted from supplier parties and passed on, so they are shown for reference and excluded from profit.
          Goods supplied to customers are tracked in the Sales &amp; Dues report; the shop&apos;s earning on them is not part of this statement.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold">Year-wise summary · {REPORT_YEARS[0]}–{REPORT_YEARS[REPORT_YEARS.length - 1]}</h3>
        <Table>
          <THead>
            <Tr>
              <Th>Year</Th>
              <Th className="text-right">Bills</Th>
              <Th className="text-right">Gross sales</Th>
              <Th className="text-right">Commission earned</Th>
              <Th className="text-right">Shop expenses</Th>
              <Th className="text-right">Profit / loss</Th>
            </Tr>
          </THead>
          <TBody>
            {yearly.map((y) => {
              const profit = D(y.profit);
              return (
                <Tr key={y.year} className={y.year === year ? "bg-primary-soft/40" : undefined}>
                  <Td className="font-medium tabular">{y.year}</Td>
                  <Td className="text-right tabular">{y.billCount}</Td>
                  <Td className="text-right">
                    <Money value={y.gross} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={y.commission} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={y.shopExpenses} symbol={false} />
                  </Td>
                  <Td className={cn("text-right font-semibold", profit.isNegative() ? "text-destructive" : profit.greaterThan(0) ? "text-success" : "")}>
                    <Money value={y.profit} symbol={false} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
