import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HandCoins, Pencil, Plus, Printer } from "lucide-react";
import { Suspense } from "react";
import { FilterBar, FilterField } from "@/components/filters/filter-bar";
import { YearPicker } from "@/components/filters/period-links";
import { StatementDocument, formatLedgerBalance } from "@/components/print/statement";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { MONTHS_LONG, parseDateParam, parseYearParam, REPORT_YEARS } from "@/lib/dates";
import { formatPct, formatMoney, D, sum } from "@/lib/money";
import { getPartyLedger, getPartyMonthlyBreakdown } from "@/lib/queries/parties";
import { requestYear } from "@/lib/request";
import { qs } from "@/lib/utils";

export const metadata: Metadata = { title: "Party ledger" };

export default function PartyPage(props: PageProps<"/parties/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <StatSkeleton count={4} />
          <TableSkeleton rows={8} />
        </div>
      }
    >
      <PartyLedgerContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PartyLedgerContent({ params, searchParams }: Pick<PageProps<"/parties/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const partyId = Number(id);
  if (!Number.isInteger(partyId)) notFound();
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const thisYear = await requestYear();
  const year = parseYearParam(sp.year, from ? Number(from.slice(0, 4)) : thisYear);
  const [ledger, monthly] = await Promise.all([getPartyLedger(partyId, { from, to }), getPartyMonthlyBreakdown(partyId, year)]);
  if (!ledger) notFound();
  const { party } = ledger;
  const balance = D(ledger.closingBalance);
  const monthTotals = {
    bills: monthly.reduce((a, m) => a + m.billCount, 0),
    gross: sum(monthly.map((m) => m.gross)),
    commission: sum(monthly.map((m) => m.commission)),
    expenses: sum(monthly.map((m) => m.expenses)),
    net: sum(monthly.map((m) => m.net)),
    paid: sum(monthly.map((m) => m.paid)),
  };

  return (
    <>
      <PageHeader
        backHref="/parties"
        backLabel="Suppliers"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {party.name}
            <Badge variant={party.status === "ACTIVE" ? "success" : "outline"}>{party.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
          </span>
        }
        description={[party.contactPerson, party.phone, party.address, party.mainItems, `Commission ${formatPct(party.commissionRate)}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <LinkButton href={`/print/parties/${party.id}${qs({ from, to })}`} variant="outline">
              <Printer /> Print statement
            </LinkButton>
            <LinkButton href={`/parties/${party.id}/edit`} variant="outline">
              <Pencil /> Edit
            </LinkButton>
            <LinkButton href={`/transactions/new${qs({ partyId: party.id, returnTo: `/parties/${party.id}` })}`} variant="outline">
              <HandCoins /> Payment / advance
            </LinkButton>
            <LinkButton href={`/bills/new?partyId=${party.id}`}>
              <Plus /> New bill
            </LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={balance.isZero() ? "Balance" : balance.greaterThan(0) ? "Payable to party" : "Advance with party"}
          value={formatMoney(balance.abs())}
          hint={formatLedgerBalance(ledger.closingBalance)}
          tone={balance.isZero() ? "default" : balance.greaterThan(0) ? "warning" : "info"}
        />
        <StatTile label="Goods sold (gross)" value={formatMoney(ledger.billStats.gross)} hint={`${ledger.billStats.count} bill(s) in period`} />
        <StatTile label="Commission + expenses deducted" value={formatMoney(D(ledger.billStats.commission).plus(D(ledger.billStats.expenses)))} hint={`Commission ${formatMoney(ledger.billStats.commission)}`} />
        <StatTile label="Paid / advanced to party" value={formatMoney(D(ledger.totals.payments).plus(D(ledger.totals.advances)))} hint={`Payments ${formatMoney(ledger.totals.payments)} · Advances ${formatMoney(ledger.totals.advances)}`} />
      </div>

      <FilterBar action={`/parties/${party.id}`} resetHref={`/parties/${party.id}`}>
        <FilterField label="From" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </FilterField>
        <FilterField label="To" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
        </FilterField>
      </FilterBar>

      <StatementDocument ledger={ledger} />

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Month-wise khata · {year}</h2>
            <p className="text-sm text-muted-foreground">Opening + gross − commission − expenses − payments = closing, month by month.</p>
          </div>
          <YearPicker basePath={`/parties/${party.id}`} years={REPORT_YEARS} active={year} params={{ from, to }} />
        </div>
        <Table>
          <THead>
            <Tr>
              <Th>Month</Th>
              <Th className="text-right">Opening</Th>
              <Th className="text-right">Bills</Th>
              <Th className="text-right">Gross sale</Th>
              <Th className="text-right">Commission</Th>
              <Th className="text-right">Gari expenses</Th>
              <Th className="text-right">Net credited</Th>
              <Th className="text-right">Paid / advanced</Th>
              <Th className="text-right">Closing</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {monthly.map((m) => {
              const closing = D(m.closing);
              const quiet = m.billCount === 0 && D(m.paid).isZero() && D(m.opening).equals(closing);
              return (
                <Tr key={m.month} className={quiet ? "text-muted-foreground" : undefined}>
                  <Td className="font-medium">{MONTHS_LONG[m.month - 1]}</Td>
                  <Td className="text-right tabular">{formatLedgerBalance(m.opening)}</Td>
                  <Td className="text-right tabular">{m.billCount}</Td>
                  <Td className="text-right">
                    <Money value={m.gross} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={m.commission} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={m.expenses} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={m.net} symbol={false} />
                  </Td>
                  <Td className="text-right">
                    <Money value={m.paid} symbol={false} />
                  </Td>
                  <Td className="text-right font-semibold tabular">{formatLedgerBalance(m.closing)}</Td>
                  <Td>
                    {closing.isZero() ? (
                      <Badge variant="outline">Settled</Badge>
                    ) : closing.greaterThan(0) ? (
                      <Badge variant="warning">To pay</Badge>
                    ) : (
                      <Badge variant="info">Advance</Badge>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
          <TFoot>
            <Tr>
              <Td>Total {year}</Td>
              <Td className="text-right tabular text-muted-foreground">{formatLedgerBalance(monthly[0].opening)}</Td>
              <Td className="text-right tabular">{monthTotals.bills}</Td>
              <Td className="text-right">
                <Money value={monthTotals.gross} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={monthTotals.commission} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={monthTotals.expenses} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={monthTotals.net} symbol={false} />
              </Td>
              <Td className="text-right">
                <Money value={monthTotals.paid} symbol={false} />
              </Td>
              <Td className="text-right tabular">{formatLedgerBalance(monthly[11].closing)}</Td>
              <Td />
            </Tr>
          </TFoot>
        </Table>
      </section>
    </>
  );
}
