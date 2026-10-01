/**
 * Full server-side session check: signature, expiry, username and session version.
 *
 * Exports: `isSessionCurrent()`, `getSession()`.
 *
 * Notes: Use `getSession()` in protected layouts, pages and every protected route
 * handler. `proxy.ts` only does the optimistic signature check.
 */
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { getCredentialStore, type CredentialStore } from "./credentials";
import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from "./session";

/** True when the claims belong to the admin and match the current session version. */
export async function isSessionCurrent(
  claims: SessionClaims,
  deps: { store: CredentialStore; adminUsername: string },
): Promise<boolean> {
  if (claims.sub !== deps.adminUsername) {
    return false;
  }
  return claims.sv === (await deps.store.getSessionVersion());
}

/** Returns the current admin session, or null when there is none or it is stale. */
export async function getSession(): Promise<SessionClaims | null> {
  // Read cookies first: it opts the route into dynamic rendering before env is touched.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const env = getEnv();
  const claims = await verifySessionToken(token, env.sessionSecret);
  if (!claims) {
    return null;
  }
  const current = await isSessionCurrent(claims, { store: getCredentialStore(), adminUsername: env.adminUsername });
  if (!current) {
    return null;
  }
  return claims;
}
