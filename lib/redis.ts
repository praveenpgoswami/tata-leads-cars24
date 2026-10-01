/**
 * Upstash Redis client (REST), created lazily from validated env.
 *
 * Exports: `getRedis()`.
 * Notes: Server-only. Used for the admin password hash, the session version, and login
 * rate limiting. Vercel's filesystem is read-only, so this is the only writable store.
 */
import { Redis } from "@upstash/redis";
import { getEnv } from "./env";

let client: Redis | null = null;

/** Returns the shared Redis client. */
export function getRedis(): Redis {
  if (!client) {
    const env = getEnv();
    client = new Redis({ url: env.redisUrl, token: env.redisToken });
  }
  return client;
}
