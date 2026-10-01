/**
 * Tests for env validation (lib/env.ts).
 */
import { describe, expect, it } from "vitest";
import { serverEnvSchema } from "@/lib/env";

const base = {
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "$2b$12$abcdefghijklmnopqrstuuJ8hFq0ZgW3Qw9oQ2m1yJ5v8Tq3X5bK2",
  SESSION_SECRET: "x".repeat(32),
  OEM_LIVE_BASE_URL: "https://example.com",
  OEM_LIVE_TOKEN: "t",
};

describe("serverEnvSchema", () => {
  it("accepts the KV_* Redis names and makes DEV a dry run when unset", () => {
    const env = serverEnvSchema.parse({ ...base, KV_REST_API_URL: "https://r.upstash.io", KV_REST_API_TOKEN: "k" });
    expect(env.redisUrl).toBe("https://r.upstash.io");
    expect(env.oemDev).toBeNull();
    expect(env.oemTimeoutMs).toBe(8000);
  });

  it("rejects a missing Redis config", () => {
    expect(serverEnvSchema.safeParse(base).success).toBe(false);
  });

  it("rejects a mangled bcrypt hash (unescaped $ in .env)", () => {
    const result = serverEnvSchema.safeParse({
      ...base,
      ADMIN_PASSWORD_HASH: "abcdefghijklmnopqrstuuJ8hFq0ZgW3Qw9oQ2m1yJ5v8Tq3X5bK2",
      UPSTASH_REDIS_REST_URL: "https://r.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "k",
    });
    expect(result.success).toBe(false);
  });
});
