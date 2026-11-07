"use client";

import { Plus, Trash } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea, inputClassName } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { MoneyInput } from "@/components/ui/money-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type FormAction } from "@/lib/actions/types";
import { calculateBill } from "@/lib/calc";
import { COMMON_ITEMS, UNITS } from "@/lib/constants";
import { D, formatMoney, formatPct } from "@/lib/money";
import type { BillDetail } from "@/lib/queries/bills";
import type { PartyOption } from "@/lib/queries/parties";
import { cn } from "@/lib/utils";
import { focusNextField, handleEnterNavigation } from "./form-utils";

interface ItemRow {
  key: string;
  itemName: string;
  size: string;
  quantity: string;
  unit: string;
  rate: string;
}

interface BillFormProps {
  action: FormAction;
  parties: PartyOption[];
  defaultDate: string;
  defaultPartyId?: number;
  initial?: BillDetail;
  cancelHref: string;
}

function trimZero(value: string | null | undefined): string {
  if (!value) return "";
  return D(value).isZero() ? "" : D(value).toString();
}

export function BillForm({ action, parties, defaultDate, defaultPartyId, initial, cancelHref }: BillFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const initialParty = parties.find((p) => p.id === (initial?.partyId ?? defaultPartyId));
  const [partyId, setPartyId] = useState(initialParty ? String(initialParty.id) : "");
  const [billDate, setBillDate] = useState(initial?.billDate ?? defaultDate);
  const [gariNumber, setGariNumber] = useState(initial?.gariNumber ?? "");
  const [commissionPct, setCommissionPct] = useState(
    initial?.commissionPct ?? (initialParty ? D(initialParty.commissionRate).toString() : "6"),
  );
  const [freight, setFreight] = useState(trimZero(initial?.freight ?? initialParty?.defaultFreight));
  const [labour, setLabour] = useState(trimZero(initial?.labour ?? initialParty?.defaultLabour));
  const [marketFee, setMarketFee] = useState(trimZero(initial?.marketFee));
  const [munshiyana, setMunshiyana] = useState(trimZero(initial?.munshiyana));
  const [otherExpense, setOtherExpense] = useState(trimZero(initial?.otherExpense));
  const [otherExpenseNote, setOtherExpenseNote] = useState(initial?.otherExpenseNote ?? "");
  const [advanceAdjusted, setAdvanceAdjusted] = useState(trimZero(initial?.advanceAdjusted));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const counter = useRef(0);
  const newRow = (): ItemRow => ({ key: `new-${counter.current++}`, itemName: "", size: "", quantity: "", unit: "kg", rate: "" });
  const [items, setItems] = useState<ItemRow[]>(() =>
    initial && initial.items.length
      ? initial.items.map((it) => ({
          key: `item-${it.id}`,
          itemName: it.itemName,
          size: it.size ?? "",
          quantity: D(it.quantity).toString(),
          unit: it.unit,
          rate: D(it.rate).toString(),
        }))
      : [{ key: "row-0", itemName: "", size: "", quantity: "", unit: "kg", rate: "" }],
  );
  const itemInputRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusKey, setFocusKey] = useState<string | null>(null);

  useEffect(() => {
    if (!focusKey) return;
    const el = itemInputRefs.current.get(focusKey);
    if (el) {
      el.focus();
      setFocusKey(null);
    }
  }, [focusKey, items]);

  const selectedParty = parties.find((p) => String(p.id) === partyId);

  function onPartyChange(value: string) {
    setPartyId(value);
    const party = parties.find((p) => String(p.id) === value);
    if (!party) return;
    setCommissionPct(D(party.commissionRate).toString());
    if (!initial) {
      if (!freight) setFreight(trimZero(party.defaultFreight));
      if (!labour) setLabour(trimZero(party.defaultLabour));
    }
  }

  function updateItem(key: string, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** New line on a multi-size lot: same item, next size – only size/qty/rate need typing. */
  function addItem(afterKey?: string) {
    const row = newRow();
    const prev = afterKey ? items.find((r) => r.key === afterKey) : items[items.length - 1];
    if (prev && prev.itemName.trim()) {
      row.itemName = prev.itemName;
      row.unit = prev.unit;
    }
    setItems((rows) => {
      if (!afterKey) return [...rows, row];
      const idx = rows.findIndex((r) => r.key === afterKey);
      return [...rows.slice(0, idx + 1), row, ...rows.slice(idx + 1)];
    });
    setFocusKey(row.key);
  }

  function removeItem(key: string) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  const calc = useMemo(
    () =>
      calculateBill({
        items,
        commissionPct,
        freight,
        labour,
        marketFee,
        munshiyana,
        otherExpense,
        advanceAdjusted,
      }),
    [items, commissionPct, freight, labour, marketFee, munshiyana, otherExpense, advanceAdjusted],
  );

  const partyBalance = selectedParty ? D(selectedParty.balance) : null;

  return (
    <form action={formAction} onKeyDown={handleEnterNavigation} className="space-y-6">
      <FormMessage state={state} />
      {errors.items ? <p className="text-sm font-medium text-destructive">{errors.items}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gari / lot details</CardTitle>
              <CardDescription>Who sent the goods and when they arrived.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Party" htmlFor="partyId" error={errors.partyId} required className="sm:col-span-2">
                <Select id="partyId" name="partyId" value={partyId} onChange={(e) => onPartyChange(e.target.value)} required autoFocus={!initial}>
                  <option value="" disabled>
                    Select party…
                  </option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.status === "INACTIVE" ? " (inactive)" : ""}
                    </option>
                  ))}
                </Select>
                {selectedParty && partyBalance ? (
                  <p className="text-xs text-muted-foreground">
                    Current balance:{" "}
                    <span className={cn("font-medium tabular", partyBalance.isNegative() ? "text-info" : partyBalance.greaterThan(0) ? "text-warning" : "")}>
                      {formatMoney(partyBalance.abs())}{" "}
                      {partyBalance.isZero() ? "(settled)" : partyBalance.isNegative() ? "advance with party" : "payable to party"}
                    </span>
                  </p>
                ) : null}
              </Field>
              <Field label="Bill date" htmlFor="billDate" error={errors.billDate} required>
                <Input id="billDate" name="billDate" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required />
              </Field>
              <Field label="Gari / vehicle no." htmlFor="gariNumber" error={errors.gariNumber}>
                <Input id="gariNumber" name="gariNumber" value={gariNumber} onChange={(e) => setGariNumber(e.target.value)} placeholder="e.g. LES-4821" maxLength={50} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>Items sold</CardTitle>
                <CardDescription>
                  One line per size (dana) on a multi-size gari. Tab or Enter moves to the next field · Enter on the last rate adds a new line · Ctrl+Enter saves.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => addItem()}>
                <Plus /> Add line
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <datalist id="common-items">
                {COMMON_ITEMS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <datalist id="units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left font-semibold">#</th>
                      <th className="min-w-44 px-2 py-2 text-left font-semibold">Item</th>
                      <th className="w-24 px-2 py-2 text-left font-semibold">Size / dana</th>
                      <th className="w-32 px-2 py-2 text-right font-semibold">Qty</th>
                      <th className="w-28 px-2 py-2 text-left font-semibold">Unit</th>
                      <th className="w-32 px-2 py-2 text-right font-semibold">Rate</th>
                      <th className="w-36 px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="w-12 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, index) => {
                      const line = calc.items[index];
                      const isLast = index === items.length - 1;
                      return (
                        <tr key={row.key} className="border-t border-border align-top">
                          <td className="px-3 py-2 pt-3.5 text-muted-foreground tabular">{index + 1}</td>
                          <td className="px-2 py-2">
                            <Input
                              ref={(el) => {
                                if (el) itemInputRefs.current.set(row.key, el);
                                else itemInputRefs.current.delete(row.key);
                              }}
                              name={`items[${index}][itemName]`}
                              value={row.itemName}
                              onChange={(e) => updateItem(row.key, { itemName: e.target.value })}
                              list="common-items"
                              placeholder="Item name"
                              aria-label={`Item ${index + 1} name`}
                              aria-invalid={Boolean(errors[`items.${index}.itemName`])}
                              maxLength={120}
                            />
                            {errors[`items.${index}.itemName`] ? (
                              <p className="mt-1 text-xs text-destructive">{errors[`items.${index}.itemName`]}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`items[${index}][size]`}
                              value={row.size}
                              onChange={(e) => updateItem(row.key, { size: e.target.value })}
                              placeholder="—"
                              aria-label={`Item ${index + 1} size`}
                              maxLength={40}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <MoneyInput
                              name={`items[${index}][quantity]`}
                              value={row.quantity}
                              onValueChange={(v) => updateItem(row.key, { quantity: v })}
                              scale={3}
                              placeholder="0"
                              aria-label={`Item ${index + 1} quantity`}
                              aria-invalid={Boolean(errors[`items.${index}.quantity`])}
                            />
                            {errors[`items.${index}.quantity`] ? (
                              <p className="mt-1 text-xs text-destructive">{errors[`items.${index}.quantity`]}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              name={`items[${index}][unit]`}
                              value={row.unit}
                              onChange={(e) => updateItem(row.key, { unit: e.target.value })}
                              list="units"
                              aria-label={`Item ${index + 1} unit`}
                              maxLength={20}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <MoneyInput
                              name={`items[${index}][rate]`}
                              value={row.rate}
                              onValueChange={(v) => updateItem(row.key, { rate: v })}
                              placeholder="0.00"
                              aria-label={`Item ${index + 1} rate`}
                              aria-invalid={Boolean(errors[`items.${index}.rate`])}
                              data-enter="default"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                                  e.preventDefault();
                                  if (isLast) addItem(row.key);
                                  else focusNextField(e.currentTarget.form!, e.currentTarget);
                                }
                              }}
                            />
                            {errors[`items.${index}.rate`] ? (
                              <p className="mt-1 text-xs text-destructive">{errors[`items.${index}.rate`]}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 pt-3.5 text-right font-medium">
                            <Money value={line?.amount ?? "0"} symbol={false} />
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeItem(row.key)}
                              disabled={items.length === 1}
                              aria-label={`Remove item ${index + 1}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Gross amount
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        <Money value={calc.grossAmount} symbol={false} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deductions</CardTitle>
              <CardDescription>Commission and market expenses deducted from the party&apos;s gross amount.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Commission (%)" htmlFor="commissionPct" error={errors.commissionPct} required>
                <MoneyInput id="commissionPct" name="commissionPct" value={commissionPct} onValueChange={setCommissionPct} required />
              </Field>
              <Field label="Freight / kiraya" htmlFor="freight" error={errors.freight}>
                <MoneyInput id="freight" name="freight" value={freight} onValueChange={setFreight} placeholder="0.00" />
              </Field>
              <Field label="Labour / mazdoori" htmlFor="labour" error={errors.labour}>
                <MoneyInput id="labour" name="labour" value={labour} onValueChange={setLabour} placeholder="0.00" />
              </Field>
              <Field label="Market fee" htmlFor="marketFee" error={errors.marketFee}>
                <MoneyInput id="marketFee" name="marketFee" value={marketFee} onValueChange={setMarketFee} placeholder="0.00" />
              </Field>
              <Field label="Munshiyana" htmlFor="munshiyana" error={errors.munshiyana}>
                <MoneyInput id="munshiyana" name="munshiyana" value={munshiyana} onValueChange={setMunshiyana} placeholder="0.00" />
              </Field>
              <Field label="Other expense" htmlFor="otherExpense" error={errors.otherExpense}>
                <div className="flex gap-2">
                  <MoneyInput id="otherExpense" name="otherExpense" value={otherExpense} onValueChange={setOtherExpense} placeholder="0.00" className="w-32" />
                  <input
                    name="otherExpenseNote"
                    value={otherExpenseNote}
                    onChange={(e) => setOtherExpenseNote(e.target.value)}
                    placeholder="What for?"
                    aria-label="Other expense note"
                    maxLength={120}
                    className={cn(inputClassName, "flex-1")}
                  />
                </div>
              </Field>
              <Field
                label="Advance adjusted"
                htmlFor="advanceAdjusted"
                error={errors.advanceAdjusted}
                hint={
                  partyBalance && partyBalance.isNegative()
                    ? `Party holds ${formatMoney(partyBalance.abs())} advance`
                    : "Part of an earlier advance recovered from this bill"
                }
              >
                <MoneyInput id="advanceAdjusted" name="advanceAdjusted" value={advanceAdjusted} onValueChange={setAdvanceAdjusted} placeholder="0.00" />
              </Field>
              <Field label="Notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2">
                <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Optional remarks printed on the patti" />
              </Field>
            </CardContent>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <CardTitle>Patti summary</CardTitle>
              <CardDescription>Updates as you type.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <SummaryRow label="Gross amount" value={calc.grossAmount} strong />
              <SummaryRow label={`Commission @ ${formatPct(commissionPct || "0")}`} value={calc.commissionAmount} negative />
              <SummaryRow label="Total expenses" value={calc.totalExpenses} negative />
              <div className="my-2 border-t border-border" />
              <SummaryRow label="Net amount (credited to khata)" value={calc.netAmount} strong />
              {!D(calc.advanceAdjusted).isZero() ? (
                <SummaryRow label="Advance adjusted" value={calc.advanceAdjusted} negative />
              ) : null}
              <div className="my-2 border-t border-border" />
              <div className="flex items-baseline justify-between gap-3 rounded-md bg-primary-soft px-3 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Final payable</span>
                <Money value={calc.finalPayable} className="text-lg font-bold text-primary" />
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                {items.filter((i) => i.itemName.trim()).length} item line(s)
              </p>
            </CardContent>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 p-4">
              <LinkButton href={cancelHref} variant="ghost">
                Cancel
              </LinkButton>
              <SubmitButton pendingText="Saving…">{initial ? "Save changes" : "Save bill"}</SubmitButton>
            </div>
          </Card>
        </aside>
      </div>
    </form>
  );
}

function SummaryRow({ label, value, strong, negative }: { label: string; value: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</span>
      <span className={cn("tabular", strong && "font-semibold", negative && "text-destructive")}>
        {negative ? "− " : ""}
        {formatMoney(value, { symbol: false })}
      </span>
    </div>
  );
}
