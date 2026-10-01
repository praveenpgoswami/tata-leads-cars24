/**
 * POST /api/auth/login: verifies admin credentials and sets the session cookie.
 *
 * Exports: `POST`.
 * Notes: Rate-limited per IP (5 per 15 min). Failures always return the same generic
 * message.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCredentialStore } from "@/lib/auth/credentials";
import { verifyLogin } from "@/lib/auth/password";
import { clientIp, getLoginRateLimiter } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { loginSchema } from "@/lib/validation/api-schemas";

const GENERIC_ERROR = "Invalid username or password.";

/** Handles a login attempt. */
export async function POST(request: NextRequest) {
  const env = getEnv();
  const ip = clientIp(request.headers);
  const limiter = getLoginRateLimiter();
  const limit = await limiter.limit(ip);
  if (!limit.success) {
    const retryAfter = Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000));
    logEvent("auth.login_rate_limited", {}, "warn");
    return jsonError(
      429,
      `Too many sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      {},
      { "Retry-After": String(retryAfter) },
    );
  }

  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(401, GENERIC_ERROR);
  }

  const store = getCredentialStore();
  const ok = await verifyLogin(parsed.data, {
    store,
    adminUsername: env.adminUsername,
    seedHash: env.adminPasswordHashSeed,
  });
  if (!ok) {
    logEvent("auth.login_failed", { remaining: limit.remaining }, "warn");
    return jsonError(401, GENERIC_ERROR);
  }

  await limiter.resetUsedTokens(ip);
  const token = await createSessionToken(
    { sub: env.adminUsername, sv: await store.getSessionVersion() },
    env.sessionSecret,
  );
  logEvent("auth.login_succeeded");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
