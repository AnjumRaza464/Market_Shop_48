import Link from "next/link";
import { Money } from "@/components/ui/money";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { D, formatPct, sum } from "@/lib/money";
import type { PartnerSettlement } from "@/lib/queries/partners";
import { cn } from "@/lib/utils";

interface PartnerSettlementTableProps {
  settlement: PartnerSettlement;
  periodLabel: string;
}

/**
 * Partner settlement (Monthly Report sheet): share = total × share%, balance = paid − share.
 * (+) the partner should receive from the others, (−) the partner should pay.
 */
export function PartnerSettlementTable({ settlement, periodLabel }: PartnerSettlementTableProps) {
  if (settlement.rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        No partners defined.{" "}
        <Link href="/partners" className="text-primary hover:underline">
          Add partners
        </Link>{" "}
        to see who paid more than their share.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {!settlement.sharesOk ? (
        <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
          Active partners’ shares add up to {formatPct(settlement.sharesTotal)} instead of 100% – fix them on the Partners page.
        </p>
      ) : null}
      <Table>
        <THead>
          <Tr>
            <Th>Partner</Th>
            <Th className="text-right">Share</Th>
            <Th className="text-right">Paid</Th>
            <Th className="text-right">Their share</Th>
            <Th className="text-right">Balance</Th>
            <Th>Status</Th>
          </Tr>
        </THead>
        <TBody>
          {settlement.rows.map((r) => {
            const bal = D(r.balance);
            return (
              <Tr key={r.id}>
                <Td className="font-medium">{r.name}</Td>
                <Td className="text-right tabular">{formatPct(r.sharePct)}</Td>
                <Td className="text-right">
                  <Money value={r.paid} symbol={false} />
                </Td>
                <Td className="text-right">
                  <Money value={r.share} symbol={false} />
                </Td>
                <Td className={cn("text-right font-semibold", bal.greaterThan(0) ? "text-success" : bal.isNegative() ? "text-destructive" : "")}>
                  <Money value={r.balance} symbol={false} signed />
                </Td>
                <Td className="text-xs text-muted-foreground">{bal.isZero() ? "Settled" : bal.greaterThan(0) ? "To receive from others" : "To pay to others"}</Td>
              </Tr>
            );
          })}
        </TBody>
        <TFoot>
          <Tr>
            <Td>Total · {periodLabel}</Td>
            <Td className="text-right tabular">{formatPct(settlement.sharesTotal)}</Td>
            <Td className="text-right">
              <Money value={sum(settlement.rows.map((r) => r.paid))} symbol={false} />
            </Td>
            <Td className="text-right">
              <Money value={sum(settlement.rows.map((r) => r.share))} symbol={false} />
            </Td>
            <Td className="text-right">
              <Money value={sum(settlement.rows.map((r) => r.balance))} symbol={false} signed />
            </Td>
            <Td />
          </Tr>
        </TFoot>
      </Table>
      <p className="text-xs text-muted-foreground">
        Total expenses {periodLabel}: <Money value={settlement.total} symbol={false} className="font-medium text-foreground" />
        {!D(settlement.shopCashBox).isZero() ? (
          <>
            {" "}
            · paid from the shop cash box <Money value={settlement.shopCashBox} symbol={false} className="font-medium text-foreground" /> (counted in the total, not against any partner)
          </>
        ) : null}
        . Balance = paid − share.
      </p>
    </div>
  );
}
