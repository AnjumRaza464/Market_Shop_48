import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { YearPicker } from "@/components/filters/period-links";
import { PrintButton } from "@/components/print/print-button";
import { PartnerSettlementTable } from "@/components/reports/partner-settlement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { EXPENSE_CATEGORIES, labelFor } from "@/lib/constants";
import { MONTHS_LONG, MONTHS_SHORT, REPORT_YEARS, parseYearParam, yearRange } from "@/lib/dates";
import { D, formatMoney, sum, ZERO } from "@/lib/money";
import { getExpenseMonthlyByPartner, getExpenseMonthlyMatrix, getExpenseYearlyTotals } from "@/lib/queries/expenses";
import { getPartnerSettlement, listPartners } from "@/lib/queries/partners";
import { requestYear } from "@/lib/request";

export const metadata: Metadata = { title: "Expense reports" };

export default function ExpenseReportPage(props: PageProps<"/reports/expenses">) {
  return (
    <>
      <PageHeader
        title="Expense Reports"
        description="Category-wise breakdown, month-wise summary, year-wise trend and partner settlement of shop overheads."
        actions={<PrintButton variant="outline">Print report</PrintButton>}
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <StatSkeleton count={4} />
            <CardSkeleton />
            <TableSkeleton rows={12} cols={8} />
          </div>
        }
      >
        <ExpenseReportContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ExpenseReportContent({ searchParams }: Pick<PageProps<"/reports/expenses">, "searchParams">) {
  const sp = await searchParams;
  const thisYear = await requestYear();
  const year = parseYearParam(sp.year, Math.min(Math.max(thisYear, REPORT_YEARS[0]), REPORT_YEARS[REPORT_YEARS.length - 1]));
  const range = yearRange(year);
  const [matrix, yearly, settlement, partners, byPartner] = await Promise.all([
    getExpenseMonthlyMatrix(year),
    getExpenseYearlyTotals(),
    getPartnerSettlement({ from: range.from, to: range.to }),
    listPartners(),
    getExpenseMonthlyByPartner(year),
  ]);

  const cell = (month: number, category: string) => matrix.find((c) => c.month === month && c.category === category)?.total ?? "0.00";
  const monthTotals = Array.from({ length: 12 }, (_, i) => sum(EXPENSE_CATEGORIES.map((c) => cell(i + 1, c.value))));
  const categoryTotals = EXPENSE_CATEGORIES.map((c) => ({ ...c, total: sum(Array.from({ length: 12 }, (_, i) => cell(i + 1, c.value))) }));
  const usedCategories = categoryTotals.filter((c) => !c.total.isZero());
  const yearTotal = sum(monthTotals);
  const activeMonths = monthTotals.filter((t) => !t.isZero()).length;
  const avgPerMonth = activeMonths ? yearTotal.dividedBy(activeMonths) : ZERO;
  const topCategory = categoryTotals.reduce((best, c) => (c.total.greaterThan(best.total) ? c : best), categoryTotals[0]);
  const topMonthIndex = monthTotals.reduce((bestIdx, t, i) => (t.greaterThan(monthTotals[bestIdx]) ? i : bestIdx), 0);

  // Categories with any spend in the report range, for the year-wise table.
  const yearlyUsed = EXPENSE_CATEGORIES.filter((c) => yearly.some((y) => !D(y.byCategory[c.value]).isZero()));
  const partnerColumns = [...partners.filter((p) => byPartner.some((r) => r.partnerId === p.id)), { id: null as number | null, name: "Shop cash box" }];
  const partnerCell = (month: number, partnerId: number | null) => byPartner.find((r) => r.month === month && r.partnerId === partnerId)?.total ?? "0.00";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Year {year}</h2>
        <YearPicker basePath="/reports/expenses" years={REPORT_YEARS} active={year} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`Total expenses ${year}`} value={formatMoney(yearTotal)} hint={`${yearly.find((y) => y.year === year)?.entries ?? 0} entries`} tone="danger" />
        <StatTile label="Average per active month" value={formatMoney(avgPerMonth)} hint={`${activeMonths} month(s) with expenses`} />
        <StatTile label="Largest category" value={yearTotal.isZero() ? "—" : topCategory.label} hint={yearTotal.isZero() ? "" : `${formatMoney(topCategory.total)} · ${topCategory.total.dividedBy(yearTotal).times(100).toFixed(0)}% of total`} />
        <StatTile label="Highest month" value={yearTotal.isZero() ? "—" : MONTHS_LONG[topMonthIndex]} hint={yearTotal.isZero() ? "" : formatMoney(monthTotals[topMonthIndex])} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly shop expenses · {year}</CardTitle>
          <CardDescription>All categories combined.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            ariaLabel={`Monthly shop expenses for ${year}`}
            series={[{ name: "Shop expenses", color: "#2a78d6" }]}
            groups={monthTotals.map((t, i) => ({ label: MONTHS_SHORT[i], values: [t.toNumber()] }))}
          />
        </CardContent>
      </Card>

      <section>
        <h3 className="mb-3 text-base font-semibold">Category-wise · {year}</h3>
        {usedCategories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No expenses recorded in {year}.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Category</Th>
                {MONTHS_SHORT.map((m) => (
                  <Th key={m} className="text-right">
                    {m}
                  </Th>
                ))}
                <Th className="text-right">Total</Th>
                <Th className="text-right">Share</Th>
              </Tr>
            </THead>
            <TBody>
              {usedCategories.map((c) => (
                <Tr key={c.value}>
                  <Td className="whitespace-nowrap font-medium">{c.label}</Td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const v = cell(i + 1, c.value);
                    return (
                      <Td key={i} className="text-right">
                        {D(v).isZero() ? <span className="text-muted-foreground/60">—</span> : <Money value={v} symbol={false} />}
                      </Td>
                    );
                  })}
                  <Td className="text-right font-semibold">
                    <Money value={c.total} symbol={false} />
                  </Td>
                  <Td className="text-right tabular text-muted-foreground">{yearTotal.isZero() ? "—" : `${c.total.dividedBy(yearTotal).times(100).toFixed(1)}%`}</Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td>Total {year}</Td>
                {monthTotals.map((t, i) => (
                  <Td key={i} className="text-right">
                    {t.isZero() ? <span className="text-muted-foreground/60">—</span> : <Money value={t} symbol={false} />}
                  </Td>
                ))}
                <Td className="text-right">
                  <Money value={yearTotal} symbol={false} />
                </Td>
                <Td className="text-right tabular">100%</Td>
              </Tr>
            </TFoot>
          </Table>
        )}
      </section>

      <section className="print-break-inside-avoid">
        <div className="mb-3">
          <h3 className="text-base font-semibold">Partner settlement · {year}</h3>
          <p className="text-sm text-muted-foreground">Each partner&apos;s share of the year&apos;s total versus what they paid themselves.</p>
        </div>
        <PartnerSettlementTable settlement={settlement} periodLabel={String(year)} />
        {partners.length ? (
          <div className="mt-4">
            <Table>
              <THead>
                <Tr>
                  <Th>Paid by</Th>
                  {MONTHS_SHORT.map((m) => (
                    <Th key={m} className="text-right">
                      {m}
                    </Th>
                  ))}
                  <Th className="text-right">Total</Th>
                </Tr>
              </THead>
              <TBody>
                {partnerColumns.map((p) => {
                  const total = sum(Array.from({ length: 12 }, (_, i) => partnerCell(i + 1, p.id)));
                  return (
                    <Tr key={p.id ?? "shop"} className={total.isZero() ? "text-muted-foreground" : undefined}>
                      <Td className="whitespace-nowrap font-medium">{p.name}</Td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const v = partnerCell(i + 1, p.id);
                        return (
                          <Td key={i} className="text-right">
                            {D(v).isZero() ? <span className="text-muted-foreground/60">—</span> : <Money value={v} symbol={false} />}
                          </Td>
                        );
                      })}
                      <Td className="text-right font-semibold">
                        <Money value={total} symbol={false} />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold">Year-wise trend · {REPORT_YEARS[0]}–{REPORT_YEARS[REPORT_YEARS.length - 1]}</h3>
        <Table>
          <THead>
            <Tr>
              <Th>Year</Th>
              {yearlyUsed.map((c) => (
                <Th key={c.value} className="text-right">
                  {labelFor(EXPENSE_CATEGORIES, c.value)}
                </Th>
              ))}
              <Th className="text-right">Total</Th>
              <Th className="text-right">Entries</Th>
            </Tr>
          </THead>
          <TBody>
            {yearly.map((y) => (
              <Tr key={y.year} className={y.year === year ? "bg-primary-soft/40" : D(y.total).isZero() ? "text-muted-foreground" : undefined}>
                <Td className="font-medium tabular">{y.year}</Td>
                {yearlyUsed.map((c) => (
                  <Td key={c.value} className="text-right">
                    {D(y.byCategory[c.value]).isZero() ? <span className="text-muted-foreground/60">—</span> : <Money value={y.byCategory[c.value]} symbol={false} />}
                  </Td>
                ))}
                <Td className="text-right font-semibold">
                  <Money value={y.total} symbol={false} />
                </Td>
                <Td className="text-right tabular">{y.entries}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
