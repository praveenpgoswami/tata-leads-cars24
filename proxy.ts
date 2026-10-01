/**
 * Route protection (Next.js 16 "proxy", formerly middleware).
 *
 * Exports: `proxy`, `config`.
 *
 * Notes: Every route except /login, /api/auth/login and static assets needs a validly
 * signed, unexpired session cookie. This is the optimistic check recommended by the
 * Next.js docs. Pages and route handlers also call `getSession()`, which checks the
 * session version in Redis. Pages without a session redirect to /login; API routes
 * return 401.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

const PUBLIC_PATHS: ReadonlySet<string> = new Set(["/login", "/api/auth/login"]);

/** Redirects or rejects requests without a valid session. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySessionToken(token, getEnv().sessionSecret))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};
