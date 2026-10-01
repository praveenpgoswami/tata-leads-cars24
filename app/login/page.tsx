/**
 * /login: centred sign-in card.
 *
 * Exports: `metadata`, default `LoginPage`.
 * Notes: An already signed-in admin is redirected to the dashboard. This uses the full
 * session check, so a stale cookie can't cause a redirect loop.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/LoginForm";
import { Alert } from "@/components/ui/Alert";
import { getSession } from "@/lib/auth/require-session";

export const metadata: Metadata = { title: "Sign in · OEM Lead Dispatcher" };

/** Sign-in page. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  if (await getSession()) {
    redirect("/");
  }
  const { changed } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-md border border-gray-200 bg-white p-8">
          <h1 className="text-lg font-semibold text-gray-900">OEM Lead Dispatcher</h1>
          <p className="mt-1 mb-6 text-sm text-gray-600">Sign in with your admin account.</p>
          {changed === "1" && (
            <Alert tone="success" className="mb-4">
              Password changed. Sign in with your new password.
            </Alert>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
