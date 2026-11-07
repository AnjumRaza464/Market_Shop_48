import "server-only";
import { io } from "next/cache";
import { currentYear, todayISO } from "@/lib/dates";

/**
 * Today's date for entry-form defaults. `io()` marks the read as request-time work so
 * Cache Components never bakes a build-time date into the static shell.
 */
export async function requestToday(): Promise<string> {
  await io();
  return todayISO();
}

export async function requestYear(): Promise<number> {
  await io();
  return currentYear();
}
