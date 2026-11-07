"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, isAuthEnabled, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, verifyPassword } from "@/lib/auth";
import { errorState, type ActionState } from "./types";

function safeNextPath(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return "/";
  return next;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isAuthEnabled()) redirect("/");
  const password = String(formData.get("password") ?? "");
  if (!password) return errorState("Enter the password.");
  if (!(await verifyPassword(password))) return errorState("Incorrect password. Please try again.");

  const token = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
