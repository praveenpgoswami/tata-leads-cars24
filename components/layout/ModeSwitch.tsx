/**
 * DEV/LIVE environment switch for the top bar.
 *
 * Exports: `ModeSwitch`.
 * Notes: Two toggle buttons (`aria-pressed`) that work with Tab and Enter/Space.
 * Switching to LIVE asks for confirmation and shows how many leads are ready. The
 * switch is locked while a send is running.
 */
"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/components/ui/cn";
import type { Mode } from "@/lib/validation/api-schemas";
import { useMode } from "./ModeProvider";

const OPTIONS: ReadonlyArray<{ mode: Mode; label: string; activeClass: string }> = [
  { mode: "dev", label: "DEV", activeClass: "bg-gray-800 text-white" },
  { mode: "live", label: "LIVE", activeClass: "bg-red-700 text-white" },
];

const DESCRIPTIONS: Readonly<Record<Mode, string>> = {
  dev: "DEV: test mode, leads are not delivered to the OEM",
  live: "LIVE: leads are delivered to the production OEM API",
};

/** Segmented DEV/LIVE control with a confirmation step for LIVE. */
export function ModeSwitch() {
  const { mode, setMode, liveReadyCount, busy } = useMode();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const choose = (next: Mode) => {
    if (next === mode) {
      return;
    }
    if (next === "live") {
      setConfirmOpen(true);
      return;
    }
    setMode(next);
  };

  return (
    <>
      <div role="group" aria-label="API environment" title={DESCRIPTIONS[mode]} className="flex items-center gap-2">
        <span className="hidden text-xs font-medium text-gray-600 sm:inline">Environment</span>
        <div className="inline-flex overflow-hidden rounded border border-gray-300 bg-white">
          {OPTIONS.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={active}
                disabled={busy}
                onClick={() => choose(option.mode)}
                className={cn(
                  "h-8 min-w-14 px-3 text-xs font-semibold tracking-wide transition-colors disabled:cursor-not-allowed",
                  active && option.activeClass,
                  !active && "text-gray-700 hover:bg-gray-100",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Switch to LIVE?"
        confirmLabel="Switch to LIVE"
        confirmVariant="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          setMode("live");
        }}
      >
        <p>
          In LIVE mode, sends go to the production OEM API and create real leads.{" "}
          <strong>{liveReadyCount}</strong> lead(s) are ready to send in LIVE.
        </p>
      </ConfirmDialog>
    </>
  );
}
