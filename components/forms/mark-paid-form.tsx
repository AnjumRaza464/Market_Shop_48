"use client";

import { useActionState, useState } from "react";
import type { PaymentMode } from "@/db/schema";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { PAYMENT_MODES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

interface MarkPaidFormProps {
  action: FormAction;
  defaultDate: string;
  finalPayable: string;
}

export function MarkPaidForm({ action, defaultDate, finalPayable }: MarkPaidFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const payable = Number(finalPayable) > 0;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment date" htmlFor="paymentDate" error={errors.paymentDate}>
          <Input id="paymentDate" name="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </Field>
        <Field label="Paid via" htmlFor="paymentMode" error={errors.paymentMode}>
          <Select id="paymentMode" name="paymentMode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Recording…">
        {payable ? `Mark paid · ${formatMoney(finalPayable)}` : "Mark as settled"}
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        {payable
          ? "Records a payment of the final payable amount in the party ledger and marks this patti as paid."
          : "Nothing is payable in cash for this patti; it will simply be marked as settled."}
      </p>
    </form>
  );
}
