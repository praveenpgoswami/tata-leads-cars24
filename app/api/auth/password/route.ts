/**
 * POST /api/auth/password: changes the admin password.
 *
 * Exports: `POST`.
 * Notes: Verifies the current password, stores the new hash in Redis, rotates the
 * session version (signing out every session) and clears this session's cookie.
 */
import { NextResponse } from "next/server";
import { getCredentialStore } from "@/lib/auth/credentials";
import { changePassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/require-session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { logEvent } from "@/lib/log";

/** Handles a change-password request. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return jsonError(401, "Your session has expired. Sign in again.");
  }

  const result = await changePassword(await readJson(request), {
    store: getCredentialStore(),
    seedHash: getEnv().adminPasswordHashSeed,
  });
  if (!result.ok) {
    return jsonError(400, "Please fix the highlighted fields.", { fieldErrors: result.fieldErrors });
  }

  logEvent("auth.password_changed", { sessionVersion: result.sessionVersion });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
