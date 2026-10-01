/**
 * Change-password form for the settings page.
 *
 * Exports: `ChangePasswordForm`.
 * Notes: Validates on the client with the same zod schema the server uses. On success
 * the server has already signed out every session, so the user is sent to /login.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { changePasswordSchema, PASSWORD_MIN_LENGTH, type ChangePasswordInput } from "@/lib/validation/api-schemas";

type FieldErrors = Partial<Record<keyof ChangePasswordInput, string>>;

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

function toFieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = FIELDS.find((name) => name === issue.path[0]);
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function readServerErrors(body: unknown): { message: string; fieldErrors: FieldErrors } {
  if (!body || typeof body !== "object") {
    return { message: "Could not change the password. Try again.", fieldErrors: {} };
  }
  const record = body as { error?: unknown; fieldErrors?: unknown };
  const fieldErrors: FieldErrors = {};
  if (record.fieldErrors && typeof record.fieldErrors === "object") {
    for (const field of FIELDS) {
      const value = (record.fieldErrors as Record<string, unknown>)[field];
      if (typeof value === "string") {
        fieldErrors[field] = value;
      }
    }
  }
  const message = typeof record.error === "string" && record.error;
  return { message: message || "Could not change the password. Try again.", fieldErrors };
}

/** Current, new and confirm password form. */
export function ChangePasswordForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(FIELDS.map((field) => [field, String(form.get(field) ?? "")]));
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error.issues));
      setFormError("");
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        router.replace("/login?changed=1");
        router.refresh();
        return;
      }
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const errors = readServerErrors(await response.json().catch(() => null));
      setFieldErrors(errors.fieldErrors);
      setFormError(errors.message);
    } catch {
      setFormError("Could not reach the server. Try again.");
    }
    setPending(false);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={fieldErrors.currentPassword}
      />
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.newPassword}
      />
      <TextField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />
      <p className="text-xs text-gray-600">
        At least {PASSWORD_MIN_LENGTH} characters, and different from your current password. You will be signed out
        everywhere and asked to sign in again.
      </p>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending && "Updating…"}
          {!pending && "Update password"}
        </Button>
      </div>
    </form>
  );
}
