"use client";

import { useActionState, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/actions/types";

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick" | "type"> {
  /** Server action already bound to its record id. */
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  confirmText?: string;
  confirmLabel?: string;
  /** Extra hidden inputs to submit with the confirmation. */
  hiddenFields?: Record<string, string>;
}

/**
 * Two-step inline confirmation (no modal dialogs): click → "Are you sure? [Yes] [No]".
 */
export function ConfirmButton({
  action,
  children,
  confirmText = "Are you sure?",
  confirmLabel = "Yes",
  hiddenFields,
  variant = "destructive",
  size = "sm",
  className,
  ...props
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(action, idleState);

  if (!armed) {
    return (
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setArmed(true)} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
      <span className="text-xs text-muted-foreground">{confirmText}</span>
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? "Working…" : confirmLabel}
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={() => setArmed(false)} disabled={pending}>
        No
      </Button>
      {state.status === "error" ? <span className="text-xs text-destructive">{state.message}</span> : null}
    </form>
  );
}
