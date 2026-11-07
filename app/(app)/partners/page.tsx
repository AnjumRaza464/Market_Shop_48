import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, UsersRound, Wallet } from "lucide-react";
import { Suspense } from "react";
import { PartnerForm } from "@/components/forms/partner-form";
import { Badge } from "@/components/ui/badge";
import { LinkButton, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { createPartner, deletePartner } from "@/lib/actions/partners";
import { D, formatPct, sum } from "@/lib/money";
import { listPartners } from "@/lib/queries/partners";

export const metadata: Metadata = { title: "Partners" };

export default function PartnersPage() {
  return (
    <>
      <PageHeader
        title="Partners"
        description="Shop partners and their share of expenses. Pick a partner in “Paid by” when recording an expense to see the settlement."
        actions={
          <LinkButton href="/expenses" variant="outline">
            <Wallet /> Shop expenses
          </LinkButton>
        }
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add partner</CardTitle>
          <CardDescription>Shares of all active partners should add up to 100%.</CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerForm action={createPartner} mode="quick" />
        </CardContent>
      </Card>
      <Suspense
        fallback={
          <div className="space-y-6">
            <FormSkeleton fields={4} />
            <TableSkeleton rows={3} cols={6} />
          </div>
        }
      >
        <PartnersTable />
      </Suspense>
    </>
  );
}

async function PartnersTable() {
  const rows = await listPartners();
  const active = rows.filter((p) => p.status === "ACTIVE");
  const shareTotal = sum(active.map((p) => p.sharePct));
  const sharesOk = active.length === 0 || shareTotal.equals(100);

  if (rows.length === 0) {
    return <EmptyState icon={<UsersRound />} title="No partners yet" description="Add the partners who share the shop's expenses, with their percentage share." />;
  }

  return (
    <>
      {!sharesOk ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
          Active partners’ shares add up to {formatPct(shareTotal)} – they should total 100% for a correct settlement.
        </p>
      ) : null}
      <Table>
        <THead>
          <Tr>
            <Th>Partner</Th>
            <Th>Phone</Th>
            <Th className="text-right">Share</Th>
            <Th className="text-right">Expenses paid</Th>
            <Th className="text-right">Total paid</Th>
            <Th>Status</Th>
            <Th className="w-32 text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((p) => (
            <Tr key={p.id}>
              <Td>
                <span className="font-medium">{p.name}</span>
                {p.notes ? <span className="block text-xs text-muted-foreground">{p.notes}</span> : null}
              </Td>
              <Td className="tabular text-muted-foreground">{p.phone ?? "—"}</Td>
              <Td className="text-right tabular">{formatPct(p.sharePct)}</Td>
              <Td className="text-right tabular">{p.expenseCount}</Td>
              <Td className="text-right">
                <Money value={p.totalPaid} symbol={false} />
              </Td>
              <Td>
                <Badge variant={p.status === "ACTIVE" ? "success" : "outline"}>{p.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/partners/${p.id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`Edit ${p.name}`}>
                    <Pencil />
                  </Link>
                  <ConfirmButton
                    action={deletePartner.bind(null, p.id)}
                    variant="ghost"
                    size="sm"
                    confirmText={p.expenseCount ? "Delete? Their expenses will count as shop cash box." : "Delete?"}
                    confirmLabel="Yes"
                    className="text-destructive"
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
        <TFoot>
          <Tr>
            <Td colSpan={2} className="text-right text-xs uppercase tracking-wide text-muted-foreground">
              Active shares
            </Td>
            <Td className={`text-right tabular ${sharesOk ? "" : "text-warning"}`}>{formatPct(shareTotal)}</Td>
            <Td className="text-right tabular">{rows.reduce((a, p) => a + p.expenseCount, 0)}</Td>
            <Td className="text-right">
              <Money value={sum(rows.map((p) => p.totalPaid))} symbol={false} />
            </Td>
            <Td colSpan={2} />
          </Tr>
        </TFoot>
      </Table>
      {D(shareTotal).isZero() ? null : (
        <p className="mt-3 text-xs text-muted-foreground">Settlement for any period is shown on the Shop Expenses page and in the Expense Reports.</p>
      )}
    </>
  );
}
