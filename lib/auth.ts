/**
 * Username + password protection for the whole app.
 *
 * Credentials come from APP_USERNAME / APP_PASSWORD and default to `admin` / `123123`
 * so the login screen is always on. AUTH_SECRET signs the session cookie.
 * Uses only Web Crypto so the same code runs in `proxy.ts` and in Server Actions.
 */
export const SESSION_COOKIE = "m48_session";
/** "Keep me signed in" sessions. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
/** Plain sign-in: expires after a working day. */
export const SHORT_SESSION_SECONDS = 60 * 60 * 12; // 12 hours

export const DEFAULT_USERNAME = "admin";
export const DEFAULT_PASSWORD = "123123";

export function getCredentials(): { username: string; password: string } {
  return {
    username: process.env.APP_USERNAME?.trim() || DEFAULT_USERNAME,
    password: process.env.APP_PASSWORD || DEFAULT_PASSWORD,
  };
}

/** True while the shop still runs on the shipped admin / 123123 login. */
export function isUsingDefaultCredentials(): boolean {
  const { username, password } = getCredentials();
  return username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD;
}

/** Login is always required; kept as a function so callers read naturally. */
export function isAuthEnabled(): boolean {
  return true;
}

let warnedAboutSecret = false;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      "[auth] AUTH_SECRET is not set (or shorter than 16 chars). Falling back to a derived secret – set AUTH_SECRET in .env for production.",
    );
  }
  const { username, password } = getCredentials();
  return `m48-fallback-secret:${username}:${password}`;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Constant-time check of both fields (compares HMACs so input length leaks nothing). */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const expected = getCredentials();
  const secret = getSecret();
  const [u1, u2, p1, p2] = await Promise.all([
    hmacHex(secret, username.trim().toLowerCase()),
    hmacHex(secret, expected.username.toLowerCase()),
    hmacHex(secret, password),
    hmacHex(secret, expected.password),
  ]);
  const userOk = constantTimeEqual(u1, u2);
  const passOk = constantTimeEqual(p1, p2);
  return userOk && passOk;
}

/** @deprecated kept for callers that only know the password. */
export async function verifyPassword(input: string): Promise<boolean> {
  return verifyCredentials(getCredentials().username, input);
}

export async function createSessionToken(maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS): Promise<string> {
  const expires = Date.now() + maxAgeSeconds * 1000;
  const payload = String(expires);
  const sig = await hmacHex(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  try {
    const expected = await hmacHex(getSecret(), payload);
    return constantTimeEqual(expected, sig);
  } catch {
    return false;
  }
}
