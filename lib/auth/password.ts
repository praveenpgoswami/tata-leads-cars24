/**
 * Password hashing, login verification and the change-password flow.
 *
 * Exports: `BCRYPT_COST`, `hashPassword()`, `verifyLogin()`, `ChangePasswordResult`,
 * `changePassword()`.
 *
 * Notes:
 * - Login always runs bcrypt, even for a wrong username, so response timing doesn't
 *   reveal which field was wrong. Callers show one generic error.
 * - A successful password change stores the new hash and bumps the session version in
 *   one Redis transaction, which signs out every existing session.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/api-schemas";
import { getEffectivePasswordHash, type CredentialStore } from "./credentials";

export const BCRYPT_COST = 12;

/** Hashes a password with bcrypt. */
export async function hashPassword(plain: string, cost: number = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(plain, cost);
}

function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

export interface AuthDeps {
  readonly store: CredentialStore;
  readonly adminUsername: string;
  readonly seedHash: string;
}

/** Checks a username and password against the admin credential. */
export async function verifyLogin(input: { username: string; password: string }, deps: AuthDeps): Promise<boolean> {
  const hash = await getEffectivePasswordHash(deps.store, deps.seedHash);
  const passwordOk = await bcrypt.compare(input.password, hash);
  const usernameOk = safeEqual(input.username, deps.adminUsername);
  return passwordOk && usernameOk;
}

export type ChangePasswordFieldErrors = Partial<Record<keyof ChangePasswordInput, string>>;

export type ChangePasswordResult =
  | { readonly ok: true; readonly sessionVersion: number }
  | { readonly ok: false; readonly fieldErrors: ChangePasswordFieldErrors };

/**
 * Validates and applies a password change.
 * @param rawInput untrusted body: { currentPassword, newPassword, confirmPassword }.
 */
export async function changePassword(
  rawInput: unknown,
  deps: Pick<AuthDeps, "store" | "seedHash"> & { readonly cost?: number },
): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: ChangePasswordFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === "currentPassword" || field === "newPassword" || field === "confirmPassword") &&
        !fieldErrors[field]
      ) {
        fieldErrors[field] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const currentHash = await getEffectivePasswordHash(deps.store, deps.seedHash);
  const currentOk = await bcrypt.compare(parsed.data.currentPassword, currentHash);
  if (!currentOk) {
    return { ok: false, fieldErrors: { currentPassword: "Current password is incorrect" } };
  }

  const newHash = await hashPassword(parsed.data.newPassword, deps.cost);
  const sessionVersion = await deps.store.replacePasswordHash(newHash);
  return { ok: true, sessionVersion };
}
