/**
 * Persistent admin credential state: the changed password hash and the session version.
 *
 * Exports: `CredentialStore`, `REDIS_KEYS`, `createRedisCredentialStore()`,
 * `getCredentialStore()`, `getEffectivePasswordHash()`.
 *
 * Notes: Until the password is changed, the bcrypt hash from `ADMIN_PASSWORD_HASH` is
 * used. After a change, the Redis hash takes precedence. Incrementing the session
 * version invalidates every issued session.
 */
import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/redis";

export interface CredentialStore {
  getPasswordHash(): Promise<string | null>;
  getSessionVersion(): Promise<number>;
  /** Stores a new hash and bumps the session version atomically; returns the new version. */
  replacePasswordHash(hash: string): Promise<number>;
}

export const REDIS_KEYS = {
  passwordHash: "admin:password_hash",
  sessionVersion: "admin:session_version",
} as const;

/** Redis-backed credential store. */
export function createRedisCredentialStore(redis: Redis): CredentialStore {
  return {
    async getPasswordHash() {
      const value = await redis.get<string>(REDIS_KEYS.passwordHash);
      if (typeof value !== "string" || !value) {
        return null;
      }
      return value;
    },
    async getSessionVersion() {
      const value = await redis.get<number | string>(REDIS_KEYS.sessionVersion);
      const version = Number(value ?? 0);
      if (!Number.isFinite(version)) {
        return 0;
      }
      return version;
    },
    async replacePasswordHash(hash: string) {
      const [, version] = await redis
        .multi()
        .set(REDIS_KEYS.passwordHash, hash)
        .incr(REDIS_KEYS.sessionVersion)
        .exec<[string, number]>();
      return version;
    },
  };
}

let store: CredentialStore | null = null;

/** Returns the app's Redis-backed credential store. */
export function getCredentialStore(): CredentialStore {
  if (!store) {
    store = createRedisCredentialStore(getRedis());
  }
  return store;
}

/** Returns the Redis hash when present, otherwise the env seed hash. */
export async function getEffectivePasswordHash(store: CredentialStore, seedHash: string): Promise<string> {
  return (await store.getPasswordHash()) ?? seedHash;
}
