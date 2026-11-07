import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { YearPicker } from "@/components/filters/period-links";
import { PrintButton } from "@/components/print/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDueBalance, Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { formatDate, MONTHS_LONG, MONTHS_SHORT, parseDateParam, parseYearParam, REPORT_YEARS, yearRange } from "@/lib/dates";
import { D, formatMoney, formatQty, sum } from "@/lib/money";
import { getCustomersSummary } from "@/lib/queries/customers";
import { getSalesByItem, getSalesMonthly, getSalesOverview, getSalesPeriodSummary, getSalesYearly, getTopDueCustomers } from "@/lib/queries/sales";
import { requestToday, requestYear } from "@/lib/request";
import { cn, qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Sales report" };

export default function SalesReportPage(props: PageProps<"/reports/sales">) {
  return (
    <>
      <PageHeader
        title="Sales & Customer Dues Report"
        description="Market outstanding, top dues, day report, month-wise and year-wise goods given vs cash received, and a customer-wise view for any period."
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
        <SalesReportContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SalesReportContent({ searchParams }: Pick<PageProps<"/reports/sales">, "searchParams">) {
  const sp = await searchParams;
  const [today, thisYear] = await Promise.all([requestToday(), requestYear()]);
  const year = parseYearParam(sp.year, Math.min(Math.max(thisYear, REPORT_YEARS[0]), REPORT_YEARS[REPORT_YEARS.length - 1]));
  const day = parseDateParam(sp.day) ?? today;
  const from = parseDateParam(sp.from) ?? yearRange(year).from;
  const to = parseDateParam(sp.to) ?? yearRange(year).to;

  const [overview, topDue, dayReport, monthly, yearly, customerPeriod, byItem] = await Promise.all([
    getSalesOverview(),
    getTopDueCustomers(15),
    getSalesPeriodSummary({ from: day, to: day }),
    getSalesMonthly(year),
    getSalesYearly(),
    getCustomersSummary({ from, to }),
    getSalesByItem({ from, to }),
  ]);

  const yearTotals = {
    goods: sum(monthly.map((m) => m.goods)),
    received: sum(monthly.map((m) => m.received)),
    qty: sum(monthly.map((m) => m.qty)),
    entries: monthly.reduce((a, m) => a + m.entries, 0),
  };
  const activeRows = customerPeriod.filter((c) => c.entries > 0 || !D(c.opening).isZero() || !D(c.closing).isZero());
  const periodTotals = {
    opening: sum(activeRows.map((c) => c.opening)),
    debit: sum(activeRows.map((c) => c.debit)),
    credit: sum(activeRows.map((c) => c.credit)),
    closing: sum(activeRows.map((c) => c.closing)),
    qty: sum(activeRows.map((c) => c.qty)),
  };
  const keep = { year: String(year), day, from, to };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-base font-semibold">Market position today</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total market outstanding" value={formatMoney(overview.outstanding)} hint={`${overview.withDues} customers owe us`} tone="danger" />
          <StatTile label="Customer advances" value={formatMoney(overview.advances)} hint={`${overview.withAdvance} customers paid ahead`} tone="info" />
          <StatTile label="Total goods given" value={formatMoney(overview.totalGoods)} hint={`${overview.entries} entries · opening ${formatMoney(overview.totalOpening)}`} />
          <StatTile label="Total received" value={formatMoney(overview.totalReceived)} hint={overview.lastEntry ? `Last entry ${formatDate(overview.lastEntry)}` : "No entries yet"} tone="success" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="print-break-inside-avoid">
          <h2 className="mb-3 text-base font-semibold">Top outstanding customers</h2>
          {topDue.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No customer has dues right now.</p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>#</Th>
                  <Th>Customer</Th>
                  <Th>Phone</Th>
                  <Th>Mandi / city</Th>
                  <Th className="text-right">Due</Th>
                  <Th>Last entry</Th>
                  <Th className="text-right">Entries</Th>
                </Tr>
              </THead>
              <TBody>
                {topDue.map((c, i) => (
                  <Tr key={c.id}>
                    <Td className="tabular text-muted-foreground">{i + 1}</Td>
                    <Td>
                      <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                    </Td>
                    <Td className="tabular text-muted-foreground">{c.phone ?? "—"}</Td>
                    <Td className="text-muted-foreground">{c.city ?? "—"}</Td>
                    <Td className="text-right font-semibold text-destructive">
                      <Money value={c.due} symbol={false} />
                    </Td>
                    <Td className="whitespace-nowrap tabular text-muted-foreground">{c.lastEntry ? formatDate(c.lastEntry) : "—"}</Td>
                    <Td className="text-right tabular">{c.entries}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </section>

        <section className="print-break-inside-avoid">
          <h2 className="mb-3 text-base font-semibold">Day report</h2>
          <Card>
            <CardContent className="space-y-4 pt-5">
              <FilterBar action="/reports/sales" hidden={{ year: keep.year, from: keep.from, to: keep.to }} className="mb-0 border-0 p-0 shadow-none">
                <FilterField label="Select date" htmlFor="day">
                  <Input id="day" name="day" type="date" defaultValue={day} />
                </FilterField>
              </FilterBar>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Goods given</dt>
                  <dd className="mt-1 text-lg font-semibold tabular">{formatMoney(dayReport.goods)}</dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Cash received</dt>
                  <dd className="mt-1 text-lg font-semibold tabular text-success">{formatMoney(dayReport.received)}</dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Entries</dt>
                  <dd className="mt-1 text-lg font-semibold tabular">
                    {dayReport.entries} <span className="text-xs font-normal text-muted-foreground">· {dayReport.customersServed} customers</span>
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total qty</dt>
                  <dd className="mt-1 text-lg font-semibold tabular">{formatQty(dayReport.qty)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">{formatDate(day)} · net dues added {formatMoney(dayReport.net)}</p>
            </CardContent>
          </Card>
        </section>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Month-wise · {year}</h2>
          <YearPicker basePath="/reports/sales" years={REPORT_YEARS} active={year} params={{ day }} />
        </div>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Goods given vs cash received · {year}</CardTitle>
            <CardDescription>Hover a month for exact figures.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              ariaLabel={`Monthly goods given and cash received for ${year}`}
              series={[
                { name: "Goods given", color: "#2a78d6" },
                { name: "Cash received", color: "#2f9e62" },
              ]}
              groups={monthly.map((m) => ({ label: MONTHS_SHORT[m.month - 1], values: [Number(m.goods), Number(m.received)] }))}
            />
          </CardContent>
        </Card>
        <Table>
          <THead>
            <Tr>
              <Th>Month</Th>
              <Th className="text-right">Goods given (Dr)</Th>
              <Th className="text-right">Cash received (Cr)</Th>
              <Th className="text-right">Dues added (Dr − Cr)</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Entries</Th>
              <Th className="text-right">Avg rate</Th>
            </Tr>
          </THead>
          <TBody>
            {monthly.map((m) => (
              <Tr key={m.month} className={m.entries === 0 ? "text-muted-foreground" : undefined}>
                <Td className="font-medium">{MONTHS_LONG[m.month - 1]}</Td>
                <Td className="text-right">
                  <Money value={m.goods} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={m.received} symbol={false} />
                </Td>
                <Td className={cn("text-right font-medium", D(m.duesAdded).greaterThan(0) ? "text-destructive" : D(m.duesAdded).isNegative() ? "text-success" : "")}>
                  <Money value={m.duesAdded} symbol={false} />
                </Td>
                <Td className="text-right tabular">{D(m.qty).isZero() ? "—" : formatQty(m.qty)}</Td>
                <Td className="text-right tabular">{m.entries}</Td>
                <Td className="text-right tabular">{D(m.avgRate).isZero() ? "—" : formatMoney(m.avgRate, { symbol: false })}</Td>
              </Tr>
            ))}
          </TBody>
          <TFoot>
            <Tr>
              <Td>Total {year}</Td>
              <Td className="text-right">
                <Money value={yearTotals.goods} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={yearTotals.received} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={yearTotals.goods.minus(yearTotals.received)} symbol={false} />
              </Td>
              <Td className="text-right tabular">{yearTotals.qty.isZero() ? "—" : formatQty(yearTotals.qty)}</Td>
              <Td className="text-right tabular">{yearTotals.entries}</Td>
              <Td className="text-right tabular">{yearTotals.qty.isZero() ? "—" : formatMoney(yearTotals.goods.dividedBy(yearTotals.qty), { symbol: false })}</Td>
            </Tr>
          </TFoot>
        </Table>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">
          Year-wise · {REPORT_YEARS[0]}–{REPORT_YEARS[REPORT_YEARS.length - 1]}
        </h2>
        <Table>
          <THead>
            <Tr>
              <Th>Year</Th>
              <Th className="text-right">Goods given</Th>
              <Th className="text-right">Cash received</Th>
              <Th className="text-right">Dues added</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Entries</Th>
              <Th className="text-right">Avg rate</Th>
            </Tr>
          </THead>
          <TBody>
            {yearly.map((y) => (
              <Tr key={y.year} className={y.year === year ? "bg-primary-soft/40" : y.entries === 0 ? "text-muted-foreground" : undefined}>
                <Td className="font-medium tabular">{y.year}</Td>
                <Td className="text-right">
                  <Money value={y.goods} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={y.received} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={y.duesAdded} symbol={false} />
                </Td>
                <Td className="text-right tabular">{D(y.qty).isZero() ? "—" : formatQty(y.qty)}</Td>
                <Td className="text-right tabular">{y.entries}</Td>
                <Td className="text-right tabular">{D(y.avgRate).isZero() ? "—" : formatMoney(y.avgRate, { symbol: false })}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Customer-wise · {formatDate(from)} – {formatDate(to)}</h2>
            <p className="text-sm text-muted-foreground">Opening at the start of the period, goods and cash inside it, closing at the end.</p>
          </div>
          <FilterBar action="/reports/sales" resetHref={`/reports/sales${qs({ year, day })}`} hidden={{ year: keep.year, day }} className="mb-0">
            <FilterField label="From" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={from} />
            </FilterField>
            <FilterField label="To" htmlFor="to">
              <Input id="to" name="to" type="date" defaultValue={to} />
            </FilterField>
          </FilterBar>
        </div>
        {activeRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No customer activity in this period.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Customer</Th>
                <Th>City</Th>
                <Th className="text-right">Opening</Th>
                <Th className="text-right">Goods given</Th>
                <Th className="text-right">Received</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Entries</Th>
                <Th className="text-right">Closing</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {activeRows.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link href={`/customers/${c.id}${qs({ from, to })}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{c.city ?? "—"}</Td>
                  <Td className="text-right tabular">{formatDueBalance(c.opening)}</Td>
                  <Td className="text-right">
                    <Money value={c.debit} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={c.credit} symbol={false} />
                  </Td>
                  <Td className="text-right tabular">{D(c.qty).isZero() ? "—" : formatQty(c.qty)}</Td>
                  <Td className="text-right tabular">{c.entries}</Td>
                  <Td className="text-right font-semibold tabular">{formatDueBalance(c.closing)}</Td>
                  <Td>
                    <Badge variant={c.position === "DUE" ? "danger" : c.position === "ADVANCE" ? "info" : "success"}>
                      {c.position === "DUE" ? "Due" : c.position === "ADVANCE" ? "Advance" : "Clear"}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td colSpan={2}>Total ({activeRows.length} customers)</Td>
                <Td className="text-right tabular">{formatDueBalance(periodTotals.opening.toFixed(2))}</Td>
                <Td className="text-right">
                  <Money value={periodTotals.debit} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={periodTotals.credit} symbol={false} />
                </Td>
                <Td className="text-right tabular">{periodTotals.qty.isZero() ? "—" : formatQty(periodTotals.qty)}</Td>
                <Td className="text-right tabular">{activeRows.reduce((a, c) => a + c.entries, 0)}</Td>
                <Td className="text-right tabular">{formatDueBalance(periodTotals.closing.toFixed(2))}</Td>
                <Td />
              </Tr>
            </TFoot>
          </Table>
        )}
      </section>

      <section className="print-break-inside-avoid">
        <h2 className="mb-3 text-base font-semibold">
          Item-wise · {formatDate(from)} – {formatDate(to)}
        </h2>
        {byItem.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No goods given in this period.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Item</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Goods given</Th>
                <Th className="text-right">Avg rate</Th>
                <Th className="text-right">Rows</Th>
              </Tr>
            </THead>
            <TBody>
              {byItem.map((i) => (
                <Tr key={i.itemName}>
                  <Td className="font-medium">{i.itemName}</Td>
                  <Td className="text-right tabular">{D(i.qty).isZero() ? "—" : formatQty(i.qty)}</Td>
                  <Td className="text-right">
                    <Money value={i.goods} symbol={false} />
                  </Td>
                  <Td className="text-right tabular">{D(i.avgRate).isZero() ? "—" : formatMoney(i.avgRate, { symbol: false })}</Td>
                  <Td className="text-right tabular">{i.entries}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
