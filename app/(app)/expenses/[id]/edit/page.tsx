import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExpenseForm } from "@/components/forms/expense-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FormSkeleton } from "@/components/ui/skeleton";
import { updateExpense } from "@/lib/actions/expenses";
import { getExpense } from "@/lib/queries/expenses";
import { listPartnerOptions } from "@/lib/queries/partners";

export const metadata: Metadata = { title: "Edit expense" };

export default function EditExpensePage(props: PageProps<"/expenses/[id]/edit">) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit expense" backHref="/expenses" backLabel="Shop expenses" />
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <EditExpenseContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditExpenseContent({ params }: Pick<PageProps<"/expenses/[id]/edit">, "params">) {
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isInteger(expenseId)) notFound();
  const expense = await getExpense(expenseId);
  if (!expense) notFound();
  const partners = await listPartnerOptions(expense.paidByPartnerId);

  return (
    <Card>
      <CardContent className="pt-5">
        <ExpenseForm action={updateExpense.bind(null, expense.id)} defaultDate={expense.expenseDate} partners={partners} initial={expense} mode="edit" cancelHref="/expenses" />
      </CardContent>
    </Card>
  );
}
