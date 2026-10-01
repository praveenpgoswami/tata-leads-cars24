/**
 * Signed JWT session tokens (HS256, via jose) and cookie settings.
 *
 * Exports: `SESSION_COOKIE`, `SESSION_TTL_SECONDS`, `SessionClaims`,
 * `sessionCookieOptions()`, `createSessionToken()`, `verifySessionToken()`.
 *
 * Notes: Has no Redis or Next.js dependencies, so `proxy.ts` can use it for the
 * optimistic check. The `sv` claim (session version) is compared with Redis in
 * `require-session.ts`.
 */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "oem_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const ISSUER = "oem-lead-dispatcher";

export interface SessionClaims {
  readonly sub: string;
  readonly sv: number;
}

const keyFor = (secret: string): Uint8Array => new TextEncoder().encode(secret);

/** Cookie attributes for the session: httpOnly, SameSite=Strict, Secure in production. */
export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

/** Signs a session token for the admin. */
export async function createSessionToken(claims: SessionClaims, secret: string): Promise<string> {
  return new SignJWT({ sv: claims.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(keyFor(secret));
}

/**
 * Verifies the signature, issuer and expiry.
 * @returns the claims, or null for any invalid token.
 */
export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, keyFor(secret), { issuer: ISSUER, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") {
      return null;
    }
    return { sub: payload.sub, sv: payload.sv };
  } catch {
    return null;
  }
}
