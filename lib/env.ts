/**
 * Server environment variables, validated with zod.
 *
 * Exports:
 * - `serverEnvSchema`: the zod schema (exported for tests).
 * - `ServerEnv`: the parsed, normalised env type.
 * - `getEnv()`: parses `process.env` once and caches the result.
 *
 * Notes:
 * - Server-only. Never import this from a client component; none of these values may
 *   reach the browser.
 * - `instrumentation.ts` calls `getEnv()` at server startup so a misconfigured
 *   deployment fails fast with a readable error.
 * - Redis credentials are accepted under either the Upstash names or the `KV_*` names
 *   that Vercel's Upstash integration injects.
 */
import { z } from "zod";

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalUrl = optionalString.pipe(z.url().optional());

export const serverEnvSchema = z
  .object({
    ADMIN_USERNAME: z.string().trim().min(1, "ADMIN_USERNAME is required"),
    ADMIN_PASSWORD_HASH: z
      .string()
      .trim()
      .regex(
        BCRYPT_HASH,
        "ADMIN_PASSWORD_HASH must be a bcrypt hash (generate with `npm run hash-password -- <plain>`; escape each $ as \\$ in .env files)",
      ),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    KV_REST_API_URL: optionalUrl,
    KV_REST_API_TOKEN: optionalString,
    OEM_LIVE_BASE_URL: z.url("OEM_LIVE_BASE_URL must be a URL"),
    OEM_LIVE_TOKEN: z.string().trim().min(1, "OEM_LIVE_TOKEN is required"),
    OEM_DEV_BASE_URL: optionalUrl,
    OEM_DEV_TOKEN: optionalString,
    OEM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(20000).default(8000),
  })
  .transform((env, ctx) => {
    const redisUrl = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
    const redisToken = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
    if (!redisUrl || !redisToken) {
      ctx.addIssue({
        code: "custom",
        message:
          "Redis is not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN)",
      });
      return z.NEVER;
    }
    return {
      adminUsername: env.ADMIN_USERNAME,
      adminPasswordHashSeed: env.ADMIN_PASSWORD_HASH,
      sessionSecret: env.SESSION_SECRET,
      redisUrl,
      redisToken,
      oemLive: { baseUrl: env.OEM_LIVE_BASE_URL, token: env.OEM_LIVE_TOKEN },
      oemDev: buildDevTarget(env.OEM_DEV_BASE_URL, env.OEM_DEV_TOKEN),
      oemTimeoutMs: env.OEM_REQUEST_TIMEOUT_MS,
    };
  });

export type ServerEnv = z.output<typeof serverEnvSchema>;

/** DEV is a dry run unless both a DEV URL and token are configured. */
function buildDevTarget(
  baseUrl: string | undefined,
  token: string | undefined,
): { baseUrl: string; token: string } | null {
  if (!baseUrl || !token) {
    return null;
  }
  return { baseUrl, token };
}

let cached: ServerEnv | null = null;

/**
 * Returns the validated server environment, parsing it on first use.
 * @throws Error listing every invalid or missing variable.
 */
export function getEnv(): ServerEnv {
  if (cached) {
    return cached;
  }
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = result.data;
  return cached;
}
