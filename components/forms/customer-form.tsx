"use client";

import { useActionState, useState } from "react";
import type { Customer } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { D } from "@/lib/money";
import { handleEnterNavigation } from "./form-utils";

interface CustomerFormProps {
  action: FormAction;
  initial?: Customer;
  cancelHref: string;
}

export function CustomerForm({ action, initial, cancelHref }: CustomerFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const opening = D(initial?.openingBalance);
  const [name, setName] = useState(initial?.name ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [openingBalance, setOpeningBalance] = useState(initial && !opening.isZero() ? opening.abs().toFixed(2) : "");
  const [openingBalanceSide, setOpeningBalanceSide] = useState<"DUE" | "ADVANCE">(
    initial && opening.isNegative() ? "ADVANCE" : "DUE",
  );
  const [status, setStatus] = useState<Customer["status"]>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className="space-y-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
          <CardDescription>Buyer / retailer / mandi party to whom you supply goods on udhaar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Customer name" htmlFor="name" error={errors.name} required className="sm:col-span-2">
            <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} />
          </Field>
          <Field label="Owner / contact person" htmlFor="contactPerson" error={errors.contactPerson}>
            <Input id="contactPerson" name="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={30} />
          </Field>
          <Field label="Mandi / city" htmlFor="city" error={errors.city}>
            <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} placeholder="e.g. Sabzi Mandi Lahore" />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as Customer["status"])}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <Field label="Address" htmlFor="address" error={errors.address} className="sm:col-span-2">
            <Input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opening balance</CardTitle>
          <CardDescription>Old outstanding carried over from your register when you start using the app.</CardDescription>
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
              onChange={(e) => setOpeningBalanceSide(e.target.value as "DUE" | "ADVANCE")}
            >
              <option value="DUE">Customer owes us (Dr / due)</option>
              <option value="ADVANCE">Customer paid in advance (Cr)</option>
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
        <SubmitButton pendingText="Saving…">{initial ? "Save changes" : "Create customer"}</SubmitButton>
      </div>
    </form>
  );
}
