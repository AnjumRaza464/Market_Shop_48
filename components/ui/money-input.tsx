"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { sanitizeDecimalInput } from "@/lib/money";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Decimal places allowed while typing (2 for money, 3 for quantities). */
  scale?: number;
  allowNegative?: boolean;
}

/**
 * Text input tuned for fast numeric entry: numeric keypad on mobile, strips stray
 * characters while typing, right-aligned tabular figures, selects all on focus.
 */
export function MoneyInput({
  value,
  onValueChange,
  scale = 2,
  allowNegative = false,
  className,
  onFocus,
  ...props
}: MoneyInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => onValueChange(sanitizeDecimalInput(e.target.value, { scale, allowNegative }))}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
      className={cn("tabular text-right", className)}
      {...props}
    />
  );
}
