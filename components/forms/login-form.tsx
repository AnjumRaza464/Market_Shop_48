"use client";

import { ArrowRight, CircleX, Eye, EyeOff, KeyRound, LoaderCircle, UserRound } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";

interface LoginFormProps {
  next: string;
  /** Pre-fill the username field (e.g. the default `admin`). */
  defaultUsername?: string;
}

export function LoginForm({ next, defaultUsername = "" }: LoginFormProps) {
  const [state, formAction] = useActionState(login, idleState);
  const [showPassword, setShowPassword] = useState(false);
  const id = useId();
  const invalid = state.status === "error";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <label htmlFor={`${id}-username`} className="text-sm font-medium text-[var(--m48-ink)]">
          Username
        </label>
        <div className="m48-input-wrap" data-invalid={invalid}>
          <UserRound className="m48-input-icon size-4.5" aria-hidden="true" />
          <input
            id={`${id}-username`}
            name="username"
            type="text"
            className="m48-input"
            placeholder="admin"
            defaultValue={defaultUsername}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!defaultUsername}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${id}-password`} className="text-sm font-medium text-[var(--m48-ink)]">
          Password
        </label>
        <div className="m48-input-wrap" data-invalid={invalid}>
          <KeyRound className="m48-input-icon size-4.5" aria-hidden="true" />
          <input
            id={`${id}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            className="m48-input pr-12"
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus={Boolean(defaultUsername)}
            required
          />
          <button
            type="button"
            className="m48-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-[var(--m48-ink-muted)]">
        <input type="checkbox" name="remember" className="m48-check" defaultChecked />
        Keep me signed in for 30 days
      </label>

      {state.status === "error" && state.message ? (
        <div role="alert" className="m48-error">
          <CircleX className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="m48-submit flex w-full items-center justify-center gap-2" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="size-4.5 animate-spin" />
          Opening the khata…
        </>
      ) : (
        <>
          Sign in to the shop
          <ArrowRight className="size-4.5" />
        </>
      )}
    </button>
  );
}
