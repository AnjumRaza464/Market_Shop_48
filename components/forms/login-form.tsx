"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { login } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(login, idleState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Password" htmlFor="password" required>
        <Input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
