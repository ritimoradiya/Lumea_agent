import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin authentication — a single shared password.
 *
 * This is NOT real authentication. There are no user accounts, no session
 * store, and no rate limiting on the login form. It is a demonstration gate,
 * and it is documented as such in the README rather than left for someone to
 * discover.
 *
 * What it does get right: the cookie holds an HMAC keyed BY the password
 * rather than the password itself, so a stolen cookie does not reveal the
 * secret and cannot be forged without it. Comparisons are constant-time, so
 * the endpoint does not leak the password one character at a time.
 */

const COOKIE = "lumea_admin";
const PAYLOAD = "lumea-admin-v1";

function secret(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD is not set in .env.local — the admin area cannot open without one."
    );
  }
  return password;
}

function expectedToken(): string {
  return createHmac("sha256", secret()).update(PAYLOAD).digest("hex");
}

/** Constant-time comparison, so timing cannot reveal the password. */
export function passwordMatches(candidate: string): boolean {
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(secret(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function openSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function closeSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(expectedToken(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
