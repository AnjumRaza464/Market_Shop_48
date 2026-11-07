"use client";

import { useActionState, useState } from "react";
import type { PaymentMode, TransactionType } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { MANUAL_TRANSACTION_TYPES, PAYMENT_MODES } from "@/lib/constants";
import { D, formatMoney } from "@/lib/money";
import type { PartyOption } from "@/lib/queries/parties";
import { cn } from "@/lib/utils";
import { handleEnterNavigation } from "./form-utils";

type ManualType = Exclude<TransactionType, "BILL">;

interface TransactionFormProps {
  action: FormAction;
  parties: PartyOption[];
  defaultDate: string;
  defaultPartyId?: number;
  defaultType?: ManualType;
  returnTo?: string;
  cancelHref: string;
}

export function TransactionForm({
  action,
  parties,
  defaultDate,
  defaultPartyId,
  defaultType = "PAYMENT",
  returnTo,
  cancelHref,
}: TransactionFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const [partyId, setPartyId] = useState(defaultPartyId ? String(defaultPartyId) : "");
  const [type, setType] = useState<ManualType>(defaultType);
  const [txnDate, setTxnDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"DEBIT" | "CREDIT">("CREDIT");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [description, setDescription] = useState("");

  const party = parties.find((p) => String(p.id) === partyId);
  const balance = party ? D(party.balance) : null;
  const typeInfo = MANUAL_TRANSACTION_TYPES.find((t) => t.value === type);

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className="space-y-6">
      <FormMessage state={state} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Transaction</CardTitle>
          <CardDescription>Payments, advances and receipts are posted straight to the party&apos;s khata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Party" htmlFor="partyId" error={errors.partyId} required className="sm:col-span-2">
            <Select id="partyId" name="partyId" value={partyId} onChange={(e) => setPartyId(e.target.value)} required autoFocus>
              <option value="" disabled>
                Select party…
              </option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {party && balance ? (
              <p className="text-xs text-muted-foreground">
                Current balance:{" "}
                <span className={cn("font-medium tabular", balance.isNegative() ? "text-info" : balance.greaterThan(0) ? "text-warning" : "")}>
                  {formatMoney(balance.abs())}{" "}
                  {balance.isZero() ? "(settled)" : balance.isNegative() ? "advance with party" : "payable to party"}
                </span>
              </p>
            ) : null}
          </Field>

          <Field label="Type" htmlFor="type" error={errors.type} required hint={typeInfo?.hint}>
            <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as ManualType)}>
              {MANUAL_TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" htmlFor="txnDate" error={errors.txnDate} required>
            <Input id="txnDate" name="txnDate" type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          </Field>

          <Field label="Amount" htmlFor="amount" error={errors.amount} required>
            <MoneyInput id="amount" name="amount" value={amount} onValueChange={setAmount} placeholder="0.00" required />
          </Field>

          {type === "ADJUSTMENT" ? (
            <Field label="Adjustment side" htmlFor="side" error={errors.side} required>
              <Select id="side" name="side" value={side} onChange={(e) => setSide(e.target.value as "DEBIT" | "CREDIT")}>
                <option value="CREDIT">Credit – increase what we owe the party</option>
                <option value="DEBIT">Debit – reduce what we owe the party</option>
              </Select>
            </Field>
          ) : (
            <Field label="Paid via" htmlFor="paymentMode" error={errors.paymentMode}>
              <Select id="paymentMode" name="paymentMode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. Cash paid against October pattis"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <LinkButton href={cancelHref} variant="ghost">
          Cancel
        </LinkButton>
        <SubmitButton pendingText="Saving…">Save transaction</SubmitButton>
      </div>
    </form>
  );
}
