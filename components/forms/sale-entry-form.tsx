"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { PaymentMode, SaleEntry } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { calculateSaleEntry } from "@/lib/calc";
import { COMMON_ITEMS, PAYMENT_MODES, UNITS } from "@/lib/constants";
import { D, formatMoney } from "@/lib/money";
import type { CustomerOption } from "@/lib/queries/customers";
import { cn } from "@/lib/utils";
import { handleEnterNavigation } from "./form-utils";

interface SaleEntryFormProps {
  action: FormAction;
  customers: CustomerOption[];
  /** Item names already used, merged with the common list for the datalist. */
  items?: string[];
  defaultDate: string;
  defaultCustomerId?: number;
  initial?: SaleEntry;
  /** Quick mode keeps the form on the page and clears the row after each save. */
  mode: "quick" | "edit";
  returnTo?: string;
  cancelHref?: string;
  className?: string;
}

function trimZero(value: string | null | undefined): string {
  if (!value) return "";
  return D(value).isZero() ? "" : D(value).toString();
}

export function SaleEntryForm({
  action,
  customers,
  items = [],
  defaultDate,
  defaultCustomerId,
  initial,
  mode,
  returnTo,
  cancelHref,
  className,
}: SaleEntryFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const quick = mode === "quick";

  const [customerId, setCustomerId] = useState(initial ? String(initial.customerId) : defaultCustomerId ? String(defaultCustomerId) : "");
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? defaultDate);
  const [itemName, setItemName] = useState(initial?.itemName ?? "");
  const [quantity, setQuantity] = useState(trimZero(initial?.quantity));
  const [unit, setUnit] = useState(initial?.unit ?? "crate");
  const [rate, setRate] = useState(trimZero(initial?.rate));
  const [received, setReceived] = useState(trimZero(initial?.received));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(initial?.paymentMode ?? "CASH");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const itemRef = useRef<HTMLInputElement>(null);

  // After a successful quick save clear the row (keep date + customer) and refocus the item field.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (quick && state.status === "success") {
      setItemName("");
      setQuantity("");
      setRate("");
      setReceived("");
      setReference("");
      setRemarks("");
    }
  }
  useEffect(() => {
    if (quick && state.status === "success") itemRef.current?.focus();
  }, [state, quick]);

  const calc = calculateSaleEntry({ quantity: quantity || null, rate: rate || null, received });
  const customer = customers.find((c) => String(c.id) === customerId);
  const balance = customer ? D(customer.balance) : null;
  const newBalance = balance ? balance.plus(D(calc.amount)).minus(D(calc.received)) : null;
  const datalistItems = Array.from(new Set([...items, ...COMMON_ITEMS]));
  const idPrefix = quick ? "quick" : "edit";

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className={cn("space-y-4", className)}>
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <datalist id={`${idPrefix}-sale-items`}>
        {datalistItems.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id={`${idPrefix}-sale-units`}>
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date" htmlFor={`${idPrefix}-entryDate`} error={errors.entryDate} required>
          <Input id={`${idPrefix}-entryDate`} name="entryDate" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        </Field>
        <Field label="Customer" htmlFor={`${idPrefix}-customerId`} error={errors.customerId} required className="sm:col-span-2 lg:col-span-3">
          <Select id={`${idPrefix}-customerId`} name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required autoFocus={!initial && !defaultCustomerId}>
            <option value="" disabled>
              Select customer…
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` · ${c.city}` : ""}
                {c.status === "INACTIVE" ? " (inactive)" : ""}
              </option>
            ))}
          </Select>
          {customer && balance ? (
            <p className="text-xs text-muted-foreground">
              Current balance:{" "}
              <span className={cn("font-medium tabular", balance.greaterThan(0) ? "text-destructive" : balance.isNegative() ? "text-info" : "")}>
                {formatMoney(balance.abs())} {balance.isZero() ? "(clear)" : balance.greaterThan(0) ? "due from customer" : "advance with us"}
              </span>
              {newBalance && !newBalance.equals(balance) ? (
                <>
                  {" "}
                  → after this entry{" "}
                  <span className={cn("font-medium tabular", newBalance.greaterThan(0) ? "text-destructive" : newBalance.isNegative() ? "text-info" : "")}>
                    {formatMoney(newBalance.abs())} {newBalance.isZero() ? "(clear)" : newBalance.greaterThan(0) ? "due" : "advance"}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goods given (debit)</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
          <Field label="Item" htmlFor={`${idPrefix}-itemName`} error={errors.itemName}>
            <Input
              ref={itemRef}
              id={`${idPrefix}-itemName`}
              name="itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              list={`${idPrefix}-sale-items`}
              placeholder="e.g. Kinnow"
              maxLength={120}
            />
          </Field>
          <Field label="Qty" htmlFor={`${idPrefix}-quantity`} error={errors.quantity}>
            <MoneyInput id={`${idPrefix}-quantity`} name="quantity" value={quantity} onValueChange={setQuantity} scale={3} placeholder="0" />
          </Field>
          <Field label="Unit" htmlFor={`${idPrefix}-unit`} error={errors.unit}>
            <Input id={`${idPrefix}-unit`} name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} list={`${idPrefix}-sale-units`} maxLength={20} />
          </Field>
          <Field label="Rate" htmlFor={`${idPrefix}-rate`} error={errors.rate}>
            <MoneyInput id={`${idPrefix}-rate`} name="rate" value={rate} onValueChange={setRate} placeholder="0.00" />
          </Field>
          <Field label="Amount (qty × rate)" htmlFor={`${idPrefix}-amount`}>
            <div id={`${idPrefix}-amount`} className="flex h-9 items-center justify-end rounded-md border border-dashed border-border bg-card px-3 text-sm font-semibold">
              <Money value={calc.amount} symbol={false} />
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash received (credit)</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
          <Field label="Received" htmlFor={`${idPrefix}-received`} error={errors.received} hint="Leave blank for goods only">
            <MoneyInput id={`${idPrefix}-received`} name="received" value={received} onValueChange={setReceived} placeholder="0.00" />
          </Field>
          <Field label="Mode" htmlFor={`${idPrefix}-paymentMode`} error={errors.paymentMode}>
            <Select id={`${idPrefix}-paymentMode`} name="paymentMode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bill / receipt no." htmlFor={`${idPrefix}-reference`} error={errors.reference}>
            <Input id={`${idPrefix}-reference`} name="reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={50} placeholder="Optional" />
          </Field>
          <Field label="Remarks" htmlFor={`${idPrefix}-remarks`} error={errors.remarks}>
            <Input id={`${idPrefix}-remarks`} name="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} placeholder="Optional" />
          </Field>
        </div>
      </div>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Enter moves to the next field · Ctrl+Enter saves
          {quick ? " · date and customer stay selected for the next row" : ""}
        </p>
        <div className="flex items-center gap-2">
          {cancelHref ? (
            <LinkButton href={cancelHref} variant="ghost">
              Cancel
            </LinkButton>
          ) : null}
          <SubmitButton pendingText="Saving…">{quick ? "Add entry" : "Save changes"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
