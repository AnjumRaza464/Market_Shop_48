/**
 * Minimal single-password protection for the whole app.
 *
 * Enabled by setting APP_PASSWORD (and AUTH_SECRET). Uses only Web Crypto so the same
 * code runs in `proxy.ts` and in Server Actions.
 */
export const SESSION_COOKIE = "m48_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0);
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (at least 16 characters) when APP_PASSWORD is configured.");
  }
  return secret;
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

export async function verifyPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  // Compare HMACs so the comparison is constant-time regardless of input length.
  const secret = getSecret();
  const [a, b] = await Promise.all([hmacHex(secret, input), hmacHex(secret, expected)]);
  return constantTimeEqual(a, b);
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
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
