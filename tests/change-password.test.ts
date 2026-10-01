/**
 * Tests for login verification, the change-password flow and session rotation
 * (lib/auth/password.ts, lib/auth/session.ts, lib/auth/require-session.ts).
 */
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialStore } from "@/lib/auth/credentials";
import { changePassword, verifyLogin } from "@/lib/auth/password";
import { isSessionCurrent } from "@/lib/auth/require-session";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const COST = 4;
const SECRET = "s".repeat(40);

function memoryStore(): CredentialStore & { hash: string | null; version: number } {
  return {
    hash: null,
    version: 0,
    async getPasswordHash() {
      return this.hash;
    },
    async getSessionVersion() {
      return this.version;
    },
    async replacePasswordHash(hash: string) {
      this.hash = hash;
      this.version += 1;
      return this.version;
    },
  };
}

let store: ReturnType<typeof memoryStore>;
let seedHash: string;

beforeEach(async () => {
  store = memoryStore();
  seedHash = await bcrypt.hash("seed-password", COST);
});

const deps = () => ({ store, seedHash, cost: COST });

describe("verifyLogin", () => {
  it("accepts the env seed until a password is stored, then only the stored one", async () => {
    const auth = { store, adminUsername: "admin", seedHash };
    expect(await verifyLogin({ username: "admin", password: "seed-password" }, auth)).toBe(true);
    expect(await verifyLogin({ username: "other", password: "seed-password" }, auth)).toBe(false);
    expect(await verifyLogin({ username: "admin", password: "wrong" }, auth)).toBe(false);

    store.hash = await bcrypt.hash("new-password-1", COST);
    expect(await verifyLogin({ username: "admin", password: "seed-password" }, auth)).toBe(false);
    expect(await verifyLogin({ username: "admin", password: "new-password-1" }, auth)).toBe(true);
  });
});

describe("changePassword", () => {
  const valid = { currentPassword: "seed-password", newPassword: "brand-new-pass", confirmPassword: "brand-new-pass" };

  it("rejects a wrong current password without changing anything", async () => {
    const result = await changePassword({ ...valid, currentPassword: "nope" }, deps());
    expect(result).toEqual({ ok: false, fieldErrors: { currentPassword: "Current password is incorrect" } });
    expect(store.hash).toBeNull();
    expect(store.version).toBe(0);
  });

  it("enforces length, confirmation and difference rules", async () => {
    const short = await changePassword({ ...valid, newPassword: "short", confirmPassword: "short" }, deps());
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.fieldErrors.newPassword).toMatch(/at least 8/);
    }

    const mismatch = await changePassword({ ...valid, confirmPassword: "different-pass" }, deps());
    expect(!mismatch.ok && mismatch.fieldErrors.confirmPassword).toBe("Passwords do not match");

    const same = await changePassword(
      { currentPassword: "seed-password", newPassword: "seed-password", confirmPassword: "seed-password" },
      deps(),
    );
    expect(!same.ok && same.fieldErrors.newPassword).toMatch(/different/);

    expect((await changePassword(undefined, deps())).ok).toBe(false);
    expect(store.version).toBe(0);
  });

  it("stores the new hash, bumps the session version and invalidates old sessions", async () => {
    const oldToken = await createSessionToken({ sub: "admin", sv: 0 }, SECRET);
    const oldClaims = await verifySessionToken(oldToken, SECRET);
    expect(oldClaims).not.toBeNull();
    if (!oldClaims) {
      return;
    }
    expect(await isSessionCurrent(oldClaims, { store, adminUsername: "admin" })).toBe(true);

    const result = await changePassword(valid, deps());
    expect(result).toEqual({ ok: true, sessionVersion: 1 });
    expect(await bcrypt.compare("brand-new-pass", store.hash ?? "")).toBe(true);
    expect(await isSessionCurrent(oldClaims, { store, adminUsername: "admin" })).toBe(false);

    const second = await changePassword(
      { currentPassword: "brand-new-pass", newPassword: "third-password", confirmPassword: "third-password" },
      deps(),
    );
    expect(second.ok).toBe(true);
  });
});

describe("session tokens", () => {
  it("rejects tampered tokens, wrong secrets and other users", async () => {
    const token = await createSessionToken({ sub: "admin", sv: 3 }, SECRET);
    expect(await verifySessionToken(token, SECRET)).toEqual({ sub: "admin", sv: 3 });
    expect(await verifySessionToken(token, "x".repeat(40))).toBeNull();
    expect(await verifySessionToken(`${token}x`, SECRET)).toBeNull();
    expect(await isSessionCurrent({ sub: "intruder", sv: 0 }, { store, adminUsername: "admin" })).toBe(false);
  });
});
