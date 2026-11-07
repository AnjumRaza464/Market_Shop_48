import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Defence in depth for Server Actions: `proxy.ts` already gates every route, but
 * actions are reachable with a raw POST, so verify the session again here.
 */
export async function requireSession(): Promise<void> {
  if (!isAuthEnabled()) return;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) redirect("/login");
}

/** Normalise unknown errors (Postgres, network) into a user-facing message. */
export function describeError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: string }).code;
    if (code === "23503") return "This record is still referenced by bills or transactions and cannot be deleted.";
    if (code === "23514") return "A value is out of range (check amounts and percentages).";
    if (code === "23505") return "A record with the same details already exists.";
    const message = (error as { message?: string }).message;
    if (process.env.NODE_ENV !== "production" && message) return `${fallback} (${message})`;
  }
  return fallback;
}
