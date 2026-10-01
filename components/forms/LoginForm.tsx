/**
 * Admin sign-in form.
 *
 * Exports: `LoginForm`.
 * Notes: Shows the server's generic error and never says which field was wrong.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { loginSchema } from "@/lib/validation/api-schemas";

/** Username and password form that posts to /api/auth/login. */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ username: form.get("username"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your username and password.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      setError(errorMessage(body));
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setPending(false);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="Username" name="username" autoComplete="username" required autoFocus />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" variant="primary" disabled={pending} className="mt-2 w-full">
        {pending && "Signing in…"}
        {!pending && "Sign in"}
      </Button>
    </form>
  );
}

function errorMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return "Sign-in failed. Try again.";
}
