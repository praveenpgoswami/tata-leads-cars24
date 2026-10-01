/**
 * Layout for authenticated pages: full session check, mode context and top bar.
 *
 * Exports: default `ProtectedLayout`.
 */
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ModeProvider } from "@/components/layout/ModeProvider";
import { TopBar } from "@/components/layout/TopBar";
import { getSession } from "@/lib/auth/require-session";

/** Wraps protected pages; redirects to /login without a current session. */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  if (!(await getSession())) {
    redirect("/login");
  }
  return (
    <ModeProvider>
      <TopBar />
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">{children}</main>
    </ModeProvider>
  );
}
