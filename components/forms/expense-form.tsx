"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ExpenseCategory, PaymentMode, ShopExpense } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from "@/lib/constants";
import { D } from "@/lib/money";
import type { PartnerOption } from "@/lib/queries/partners";
import { cn } from "@/lib/utils";
import { handleEnterNavigation } from "./form-utils";

interface ExpenseFormProps {
  action: FormAction;
  defaultDate: string;
  partners: PartnerOption[];
  initial?: ShopExpense;
  /** Quick mode keeps the form on the page and clears amount/notes after each save. */
  mode: "quick" | "edit";
  cancelHref?: string;
  className?: string;
}

export function ExpenseForm({ action, defaultDate, partners, initial, mode, cancelHref, className }: ExpenseFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate ?? defaultDate);
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "TEA_MEALS");
  const [amount, setAmount] = useState(initial ? D(initial.amount).toString() : "");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(initial?.paymentMode ?? "CASH");
  const [paidBy, setPaidBy] = useState(initial?.paidByPartnerId ? String(initial.paidByPartnerId) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const amountRef = useRef<HTMLInputElement>(null);

  // After a successful quick save, clear the per-entry fields (derived-state reset during render)
  // and move focus back to the amount so the next expense can be typed straight away.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (mode === "quick" && state.status === "success") {
      setAmount("");
      setNotes("");
    }
  }
  useEffect(() => {
    if (mode === "quick" && state.status === "success") amountRef.current?.focus();
  }, [state, mode]);

  const quick = mode === "quick";

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className={cn("space-y-4", className)}>
      <div className={cn("grid gap-4", quick ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[150px_190px_140px_150px_150px_1fr_auto] xl:items-end" : "sm:grid-cols-2")}>
        <Field label="Date" htmlFor={`${mode}-expenseDate`} error={errors.expenseDate} required>
          <Input id={`${mode}-expenseDate`} name="expenseDate" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
        </Field>
        <Field label="Category" htmlFor={`${mode}-category`} error={errors.category} required>
          <Select id={`${mode}-category`} name="category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor={`${mode}-amount`} error={errors.amount} required>
          <MoneyInput ref={amountRef} id={`${mode}-amount`} name="amount" value={amount} onValueChange={setAmount} placeholder="0.00" required />
        </Field>
        <Field label="Paid by" htmlFor={`${mode}-paidByPartnerId`} error={errors.paidByPartnerId}>
          <Select id={`${mode}-paidByPartnerId`} name="paidByPartnerId" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="">Shop cash box</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === "INACTIVE" ? " (inactive)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mode" htmlFor={`${mode}-paymentMode`} error={errors.paymentMode}>
          <Select id={`${mode}-paymentMode`} name="paymentMode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description / notes" htmlFor={`${mode}-notes`} error={errors.notes} className={quick ? "" : "sm:col-span-2"}>
          <Input id={`${mode}-notes`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Morning chai" maxLength={500} />
        </Field>
        {quick ? (
          <SubmitButton pendingText="Saving…" className="xl:mb-0">
            Add expense
          </SubmitButton>
        ) : null}
      </div>

      <FormMessage state={state} />

      {!quick ? (
        <div className="flex items-center justify-end gap-2">
          {cancelHref ? (
            <LinkButton href={cancelHref} variant="ghost">
              Cancel
            </LinkButton>
          ) : null}
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
