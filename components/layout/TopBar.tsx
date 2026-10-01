/**
 * Application top bar: app name, DEV/LIVE switch, settings link and logout.
 *
 * Exports: `TopBar`.
 * Notes: In LIVE mode a red top rule and a "LIVE" label make the state obvious while
 * keeping the bar visually restrained.
 */
"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { Mode } from "@/lib/validation/api-schemas";
import { useMode } from "./ModeProvider";
import { ModeSwitch } from "./ModeSwitch";

const BAR_ACCENT: Readonly<Record<Mode, string>> = {
  dev: "border-t-gray-200",
  live: "border-t-red-700",
};

/** Sticky header shown on every protected page. */
export function TopBar() {
  const { mode, busy } = useMode();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className={cn("sticky top-0 z-20 border-t-4 border-b border-b-gray-200 bg-white", BAR_ACCENT[mode])}>
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-blue-800">
            OEM Lead Dispatcher
          </Link>
          {mode === "live" && (
            <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
              LIVE: real leads
            </span>
          )}
        </div>
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-4">
          <ModeSwitch />
          <Link
            href="/settings"
            className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Settings aria-hidden className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={logout} disabled={loggingOut || busy}>
            <LogOut aria-hidden className="size-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
