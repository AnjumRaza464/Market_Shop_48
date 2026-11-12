"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CashDirection, CashEntry, CashEntryType, PaymentMode } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { CASH_ENTRY_TYPES, PAYMENT_MODES } from "@/lib/constants";
import { D } from "@/lib/money";
import type { PartnerOption } from "@/lib/queries/partners";
import { cn } from "@/lib/utils";
import { handleEnterNavigation } from "./form-utils";

interface CashEntryFormProps {
  action: FormAction;
  defaultDate: string;
  partners: PartnerOption[];
  initial?: CashEntry;
  /** Quick mode keeps the form on the page and clears amount/notes after each save. */
  mode: "quick" | "edit";
  /** Pre-select a type (e.g. OPENING when the cash book is still empty). */
  defaultType?: CashEntryType;
  cancelHref?: string;
  className?: string;
}

export function CashEntryForm({ action, defaultDate, partners, initial, mode, defaultType, cancelHref, className }: CashEntryFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? defaultDate);
  const [type, setType] = useState<CashEntryType>(initial?.type ?? defaultType ?? "DEPOSIT");
  const [amount, setAmount] = useState(initial ? D(initial.amount).toString() : "");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(initial?.paymentMode ?? "CASH");
  const [toMode, setToMode] = useState<PaymentMode>(initial?.toMode ?? "BANK");
  const [direction, setDirection] = useState<CashDirection>(initial?.direction ?? "IN");
  const [partnerId, setPartnerId] = useState(initial?.partnerId ? String(initial.partnerId) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const amountRef = useRef<HTMLInputElement>(null);

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
  const isTransfer = type === "TRANSFER";
  const isAdjustment = type === "ADJUSTMENT";
  const hasPartner = type === "DEPOSIT" || type === "WITHDRAWAL";
  const hint = CASH_ENTRY_TYPES.find((t) => t.value === type)?.hint;

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className={cn("space-y-4", className)}>
      <div className={cn("grid gap-4", quick ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[130px_170px_120px_120px_130px_minmax(100px,1fr)_auto] xl:items-end" : "sm:grid-cols-2")}>
        <Field label="Date" htmlFor={`${mode}-entryDate`} error={errors.entryDate} required>
          <Input id={`${mode}-entryDate`} name="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        </Field>
        <Field label="Entry type" htmlFor={`${mode}-type`} error={errors.type} hint={quick ? undefined : hint} required>
          <Select id={`${mode}-type`} name="type" value={type} onChange={(e) => setType(e.target.value as CashEntryType)}>
            {CASH_ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor={`${mode}-amount`} error={errors.amount} required>
          <MoneyInput ref={amountRef} id={`${mode}-amount`} name="amount" value={amount} onValueChange={setAmount} placeholder="0.00" required />
        </Field>
        <Field label={isTransfer ? "From account" : "Account"} htmlFor={`${mode}-paymentMode`} error={errors.paymentMode}>
          <Select id={`${mode}-paymentMode`} name="paymentMode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        {isTransfer ? (
          <Field label="To account" htmlFor={`${mode}-toMode`} error={errors.toMode} required>
            <Select id={`${mode}-toMode`} name="toMode" value={toMode} onChange={(e) => setToMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : isAdjustment ? (
          <Field label="Side" htmlFor={`${mode}-direction`} error={errors.direction} required>
            <Select id={`${mode}-direction`} name="direction" value={direction} onChange={(e) => setDirection(e.target.value as CashDirection)}>
              <option value="IN">Add to cash (+)</option>
              <option value="OUT">Remove from cash (−)</option>
            </Select>
          </Field>
        ) : (
          <Field label="Partner" htmlFor={`${mode}-partnerId`} error={errors.partnerId}>
            <Select id={`${mode}-partnerId`} name="partnerId" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} disabled={!hasPartner}>
              <option value="">{hasPartner ? "— none —" : "n/a"}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "INACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Description / notes" htmlFor={`${mode}-notes`} error={errors.notes} className={quick ? "" : "sm:col-span-2"}>
          <Input id={`${mode}-notes`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={quick ? hint : "e.g. Cash deposited at HBL"} maxLength={500} />
        </Field>
        {quick ? (
          <SubmitButton pendingText="Saving…" className="xl:mb-0">
            Add entry
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
