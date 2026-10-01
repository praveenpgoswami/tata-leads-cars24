/**
 * Login rate limiting: 5 attempts per 15 minutes per IP, stored in Upstash Redis.
 *
 * Exports: `LOGIN_LIMIT`, `getLoginRateLimiter()`, `clientIp()`.
 *
 * Notes: The limiter is reset after a successful login.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

export const LOGIN_LIMIT = { attempts: 5, window: "15 m" } as const;

let limiter: Ratelimit | null = null;

/** Returns the shared login rate limiter. */
export function getLoginRateLimiter(): Ratelimit {
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(LOGIN_LIMIT.attempts, LOGIN_LIMIT.window),
      prefix: "ratelimit:login",
      analytics: false,
    });
  }
  return limiter;
}

/** Client IP from Vercel's proxy headers (first x-forwarded-for entry), or "unknown". */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
