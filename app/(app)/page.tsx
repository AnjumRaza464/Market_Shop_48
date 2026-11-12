import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, HandCoins, Landmark, Percent, Plus, ReceiptText, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import { Suspense } from "react";
import { BarChart } from "@/components/charts/bar-chart";
import { PeriodLinks } from "@/components/filters/period-links";
import { BillStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate, MONTHS_SHORT } from "@/lib/dates";
import { D, formatMoney, formatQty } from "@/lib/money";
import { resolvePeriod } from "@/lib/periods";
import { getRecentBills } from "@/lib/queries/bills";
import { getCashFlowSummary, getCashPosition } from "@/lib/queries/cash";
import { getMonthlyProfit, getPartyPositions, getPeriodSummary, getTopParties } from "@/lib/queries/reports";
import { getSalesMonthly, getSalesOverview, getSalesPeriodSummary, getTopDueCustomers } from "@/lib/queries/sales";
import { requestToday } from "@/lib/request";
import { billNumber, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Supplier pattis and commission on one side, customer udhaar and recoveries on the other, shop expenses in the middle."
        actions={
          <>
            <LinkButton href="/sales" variant="outline">
              <ShoppingBag /> Customer entry
            </LinkButton>
            <LinkButton href="/transactions/new" variant="outline">
              <HandCoins /> Record payment
            </LinkButton>
            <LinkButton href="/bills/new">
              <Plus /> New bill
            </LinkButton>
          </>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatSkeleton count={4} />
      <StatSkeleton count={4} />
      <StatSkeleton count={4} />
      <StatSkeleton count={4} />
      <CardSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}

async function DashboardContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const sp = await searchParams;
  const today = await requestToday();
  const period = resolvePeriod({ period: firstParam(sp.period), from: firstParam(sp.from), to: firstParam(sp.to) }, today);
  const year = Number(today.slice(0, 4));

  const [summary, positions, monthly, recent, topParties, salesOverview, salesPeriod, salesMonthly, topDue, cash, cashFlow] = await Promise.all([
    getPeriodSummary({ from: period.from, to: period.to }),
    getPartyPositions(),
    getMonthlyProfit(year),
    getRecentBills(8),
    getTopParties({ from: period.from, to: period.to }, 5),
    getSalesOverview(),
    getSalesPeriodSummary({ from: period.from, to: period.to }),
    getSalesMonthly(year),
    getTopDueCustomers(5),
    getCashPosition(),
    getCashFlowSummary({ from: period.from, to: period.to }),
  ]);

  const profit = D(summary.profit);
  const cashInHand = D(cash.cashInHand);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{period.label}</span>
        </p>
        <PeriodLinks basePath="/" active={period.key} />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash · nakdi</h2>
          <Link href="/cash" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Cash book <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Cash in hand"
            value={formatMoney(cash.cashInHand)}
            hint={cash.hasOpening ? "Physical cash right now · all entries to date" : "Add an opening cash entry on the Cash page to match your cash box"}
            icon={<Wallet />}
            tone={cashInHand.isNegative() ? "danger" : "success"}
          />
          <StatTile label="Bank & digital" value={formatMoney(cash.bankAndDigital)} hint={`Total funds ${formatMoney(cash.total)}`} icon={<Landmark />} tone="info" />
          <StatTile label="Cash in" value={formatMoney(cashFlow.cashIn)} hint={`Received from customers & suppliers · ${period.label}`} icon={<ArrowDownLeft />} tone="success" />
          <StatTile label="Cash out" value={formatMoney(cashFlow.cashOut)} hint={`Payments, advances & expenses · ${period.label}`} icon={<ArrowUpRight />} tone="danger" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchases · supplier pattis</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Gross sale on pattis" value={formatMoney(summary.grossSales)} hint={`${summary.billCount} bill(s) settled`} icon={<ReceiptText />} />
          <StatTile label="Commission earned" value={formatMoney(summary.commission)} hint="Shop revenue from pattis" icon={<Percent />} tone="success" />
          <StatTile label="Shop expenses" value={formatMoney(summary.shopExpenses)} hint={`${summary.expenseCount} entries`} icon={<Wallet />} tone="danger" />
          <StatTile
            label={profit.isNegative() ? "Net loss" : "Net profit"}
            value={formatMoney(profit.abs())}
            hint="Commission − shop expenses"
            icon={<TrendingUp />}
            tone={profit.isNegative() ? "danger" : "success"}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sales · customer khata</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Goods given to customers" value={formatMoney(salesPeriod.goods)} hint={`${salesPeriod.goodsRows} rows · ${formatQty(salesPeriod.qty)} qty · ${salesPeriod.customersServed} customers`} icon={<ShoppingBag />} />
          <StatTile label="Cash received from customers" value={formatMoney(salesPeriod.received)} hint={`${salesPeriod.receiptRows} receipt(s)`} icon={<Banknote />} tone="success" />
          <StatTile label="Market outstanding (dues)" value={formatMoney(salesOverview.outstanding)} hint={`${salesOverview.withDues} customers owe us · all time`} icon={<HandCoins />} tone="danger" />
          <StatTile label="Customer advances" value={formatMoney(salesOverview.advances)} hint={`${salesOverview.withAdvance} customers paid ahead · ${salesOverview.activeCustomers} active customers`} icon={<Users />} tone="info" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier khata position</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Payable to suppliers" value={formatMoney(positions.payable)} hint={`${positions.payableCount} parties we owe`} icon={<Banknote />} tone="warning" />
          <StatTile label="Advances with suppliers" value={formatMoney(positions.receivable)} hint={`${positions.receivableCount} parties owe us`} icon={<HandCoins />} tone="info" />
          <StatTile label="Pending pattis" value={String(summary.pendingCount)} hint={`${formatMoney(summary.pendingAmount)} to be paid out`} icon={<ReceiptText />} />
          <StatTile label="Active suppliers" value={String(positions.activeParties)} hint="In the khata" icon={<Users />} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Commission vs shop expenses · {year}</CardTitle>
              <CardDescription>Monthly shop revenue against operating overheads.</CardDescription>
            </div>
            <Link href={`/reports?year=${year}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Full report <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <BarChart
              ariaLabel={`Monthly commission and shop expenses for ${year}`}
              series={[
                { name: "Commission", color: "#2a78d6" },
                { name: "Shop expenses", color: "#eb6834" },
              ]}
              groups={monthly.map((m) => ({
                label: MONTHS_SHORT[m.month - 1],
                values: [Number(m.commission), Number(m.shopExpenses)],
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Goods given vs cash received · {year}</CardTitle>
              <CardDescription>Customer khata movement month by month.</CardDescription>
            </div>
            <Link href={`/reports/sales?year=${year}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Sales report <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <BarChart
              ariaLabel={`Monthly goods given and cash received for ${year}`}
              series={[
                { name: "Goods given", color: "#2a78d6" },
                { name: "Cash received", color: "#2f9e62" },
              ]}
              groups={salesMonthly.map((m) => ({
                label: MONTHS_SHORT[m.month - 1],
                values: [Number(m.goods), Number(m.received)],
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent bills</h2>
            <Link href="/bills" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              All bills <ArrowRight className="size-4" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<ReceiptText />}
              title="No bills yet"
              description="Record your first gari to see it here."
              action={
                <LinkButton href="/bills/new">
                  <Plus /> New bill
                </LinkButton>
              }
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Bill</Th>
                  <Th>Date</Th>
                  <Th>Party</Th>
                  <Th>Items</Th>
                  <Th className="text-right">Gross</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Net</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <TBody>
                {recent.map((b) => (
                  <Tr key={b.id}>
                    <Td>
                      <Link href={`/bills/${b.id}`} className="whitespace-nowrap font-medium text-primary hover:underline tabular">
                        {billNumber(b.id)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap tabular">{formatDate(b.billDate)}</Td>
                    <Td className="whitespace-nowrap font-medium">{b.partyName}</Td>
                    <Td className="max-w-40 truncate text-muted-foreground" title={b.itemsSummary ?? undefined}>
                      {b.itemsSummary ?? "—"}
                    </Td>
                    <Td className="text-right">
                      <Money value={b.grossAmount} symbol={false} />
                    </Td>
                    <Td className="text-right">
                      <Money value={b.commissionAmount} symbol={false} />
                    </Td>
                    <Td className="text-right font-medium">
                      <Money value={b.netAmount} symbol={false} />
                    </Td>
                    <Td>
                      <BillStatusBadge status={b.status} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </section>

        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Top customer dues</h2>
              <Link href="/reports/sales" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All dues <ArrowRight className="size-4" />
              </Link>
            </div>
            <Card>
              {topDue.length === 0 ? (
                <CardContent className="pt-5 text-sm text-muted-foreground">No customer owes anything right now.</CardContent>
              ) : (
                <ul className="divide-y divide-border">
                  {topDue.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-xs font-semibold text-destructive tabular">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/customers/${c.id}`} className="block truncate font-medium hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c.city ?? "—"} · last entry {c.lastEntry ? formatDate(c.lastEntry) : "—"}
                        </p>
                      </div>
                      <Money value={c.due} symbol={false} className="font-semibold text-destructive" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Top suppliers · {period.label}</h2>
              <Link href="/reports/parties" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Summary <ArrowRight className="size-4" />
              </Link>
            </div>
            <Card>
              {topParties.length === 0 ? (
                <CardContent className="pt-5 text-sm text-muted-foreground">No sales in this period.</CardContent>
              ) : (
                <ul className="divide-y divide-border">
                  {topParties.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/parties/${p.id}`} className="block truncate font-medium hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {p.billCount} bill(s) · commission {formatMoney(p.commission)}
                        </p>
                      </div>
                      <Money value={p.gross} symbol={false} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
