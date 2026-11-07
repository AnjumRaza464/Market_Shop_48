"use client";

import { useActionState, useState } from "react";
import type { Party } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { D } from "@/lib/money";
import { handleEnterNavigation } from "./form-utils";

interface PartyFormProps {
  action: FormAction;
  initial?: Party;
  cancelHref: string;
}

export function PartyForm({ action, initial, cancelHref }: PartyFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const opening = D(initial?.openingBalance);
  const [name, setName] = useState(initial?.name ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [mainItems, setMainItems] = useState(initial?.mainItems ?? "");
  const [commissionRate, setCommissionRate] = useState(initial?.commissionRate ?? "6");
  const [openingBalance, setOpeningBalance] = useState(initial ? opening.abs().toFixed(2) : "");
  const [openingBalanceSide, setOpeningBalanceSide] = useState<"CR" | "DR">(
    initial && opening.isNegative() ? "DR" : "CR",
  );
  const [defaultFreight, setDefaultFreight] = useState(initial?.defaultFreight ?? "");
  const [defaultLabour, setDefaultLabour] = useState(initial?.defaultLabour ?? "");
  const [status, setStatus] = useState<Party["status"]>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className="space-y-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Supplier party details</CardTitle>
          <CardDescription>Supplier / farmer / beopari whose goods you sell on commission (maal lene wali party).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Party name" htmlFor="name" error={errors.name} required className="sm:col-span-2">
            <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} />
          </Field>
          <Field label="Owner / contact person" htmlFor="contactPerson" error={errors.contactPerson}>
            <Input id="contactPerson" name="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} />
          </Field>
          <Field label="Market / mandi / city" htmlFor="address" error={errors.address}>
            <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} placeholder="e.g. Pattoki" />
          </Field>
          <Field label="Main items" htmlFor="mainItems" error={errors.mainItems} hint="What this party usually sends">
            <Input id="mainItems" name="mainItems" value={mainItems} onChange={(e) => setMainItems(e.target.value)} maxLength={200} placeholder="e.g. Apple, Pomegranate" />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as Party["status"])}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission & defaults</CardTitle>
          <CardDescription>Pre-filled on every new bill for this party; you can still change them per bill.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <Field label="Commission rate (%)" htmlFor="commissionRate" error={errors.commissionRate} required hint="e.g. 5, 6 or 6.5">
            <MoneyInput id="commissionRate" name="commissionRate" value={commissionRate} onValueChange={setCommissionRate} required />
          </Field>
          <Field label="Default freight / kiraya" htmlFor="defaultFreight" error={errors.defaultFreight}>
            <MoneyInput id="defaultFreight" name="defaultFreight" value={defaultFreight} onValueChange={setDefaultFreight} placeholder="0.00" />
          </Field>
          <Field label="Default labour / mazdoori" htmlFor="defaultLabour" error={errors.defaultLabour}>
            <MoneyInput id="defaultLabour" name="defaultLabour" value={defaultLabour} onValueChange={setDefaultLabour} placeholder="0.00" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening balance</CardTitle>
          <CardDescription>Balance carried over from your old register when you start using the app.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Amount" htmlFor="openingBalance" error={errors.openingBalance}>
            <MoneyInput id="openingBalance" name="openingBalance" value={openingBalance} onValueChange={setOpeningBalance} placeholder="0.00" />
          </Field>
          <Field label="Balance type" htmlFor="openingBalanceSide" error={errors.openingBalanceSide}>
            <Select
              id="openingBalanceSide"
              name="openingBalanceSide"
              value={openingBalanceSide}
              onChange={(e) => setOpeningBalanceSide(e.target.value as "CR" | "DR")}
            >
              <option value="CR">Shop owes party (Cr / payable)</option>
              <option value="DR">Party owes shop (Dr / advance)</option>
            </Select>
          </Field>
          <Field label="Notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2">
            <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <LinkButton href={cancelHref} variant="ghost">
          Cancel
        </LinkButton>
        <SubmitButton pendingText="Saving…">{initial ? "Save changes" : "Create party"}</SubmitButton>
      </div>
    </form>
  );
}
