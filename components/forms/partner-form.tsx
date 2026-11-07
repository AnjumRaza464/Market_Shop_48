"use client";

import { useActionState, useState } from "react";
import type { Partner } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { D } from "@/lib/money";
import { cn } from "@/lib/utils";
import { handleEnterNavigation } from "./form-utils";

interface PartnerFormProps {
  action: FormAction;
  initial?: Partner;
  mode: "quick" | "edit";
  cancelHref?: string;
  className?: string;
}

export function PartnerForm({ action, initial, mode, cancelHref, className }: PartnerFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const quick = mode === "quick";

  const [name, setName] = useState(initial?.name ?? "");
  const [sharePct, setSharePct] = useState(initial ? D(initial.sharePct).toString() : "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<Partner["status"]>(initial?.status ?? "ACTIVE");

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (quick && state.status === "success") {
      setName("");
      setSharePct("");
      setPhone("");
      setNotes("");
    }
  }

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className={cn("space-y-4", className)}>
      <div className={cn("grid gap-4", quick ? "sm:grid-cols-2 lg:grid-cols-[1.4fr_120px_160px_1fr_auto] lg:items-end" : "sm:grid-cols-2")}>
        <Field label="Partner name" htmlFor={`${mode}-partner-name`} error={errors.name} required>
          <Input id={`${mode}-partner-name`} name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </Field>
        <Field label="Share %" htmlFor={`${mode}-sharePct`} error={errors.sharePct} required>
          <MoneyInput id={`${mode}-sharePct`} name="sharePct" value={sharePct} onValueChange={setSharePct} placeholder="50" required />
        </Field>
        <Field label="Phone" htmlFor={`${mode}-partner-phone`} error={errors.phone}>
          <Input id={`${mode}-partner-phone`} name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} />
        </Field>
        <Field label="Notes" htmlFor={`${mode}-partner-notes`} error={errors.notes}>
          <Input id={`${mode}-partner-notes`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Optional" />
        </Field>
        {quick ? (
          <>
            <input type="hidden" name="status" value="ACTIVE" />
            <SubmitButton pendingText="Saving…">Add partner</SubmitButton>
          </>
        ) : (
          <Field label="Status" htmlFor={`${mode}-partner-status`} error={errors.status}>
            <Select id={`${mode}-partner-status`} name="status" value={status} onChange={(e) => setStatus(e.target.value as Partner["status"])}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        )}
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
