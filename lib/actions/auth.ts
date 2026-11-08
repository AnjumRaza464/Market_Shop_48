"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SHORT_SESSION_SECONDS,
  verifyCredentials,
} from "@/lib/auth";
import { errorState, type ActionState } from "./types";

function safeNextPath(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return "/";
  return next;
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!username && !password) return errorState("Enter your username and password.");
  if (!username) return errorState("Enter your username.");
  if (!password) return errorState("Enter your password.");
  if (!(await verifyCredentials(username, password))) {
    return errorState("Incorrect username or password. Please try again.");
  }

  const maxAge = remember ? SESSION_MAX_AGE_SECONDS : SHORT_SESSION_SECONDS;
  const token = await createSessionToken(maxAge);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Remembered sessions persist for 30 days; otherwise the cookie dies with the browser.
    ...(remember ? { maxAge } : {}),
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
