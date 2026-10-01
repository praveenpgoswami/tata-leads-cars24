/**
 * Client context for the DEV/LIVE mode and the dashboard state the top bar needs.
 *
 * Exports: `ModeProvider`, `useMode()`.
 * Notes: The mode always starts as DEV on page load (it isn't persisted) so a reload
 * never silently lands in LIVE. The dashboard publishes `liveReadyCount` (rows that would
 * be sent in LIVE) and `busy`, so the top-bar switch can show the lead count and lock
 * itself while a send runs.
 */
"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Mode } from "@/lib/validation/api-schemas";

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  liveReadyCount: number;
  setLiveReadyCount: (count: number) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

/** Provides mode state to the top bar and dashboard. */
export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("dev");
  const [liveReadyCount, setLiveReadyCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const value = useMemo(
    () => ({ mode, setMode, liveReadyCount, setLiveReadyCount, busy, setBusy }),
    [mode, liveReadyCount, busy],
  );
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Reads the mode context. Throws when used outside `ModeProvider`. */
export function useMode(): ModeContextValue {
  const value = useContext(ModeContext);
  if (!value) {
    throw new Error("useMode must be used inside ModeProvider");
  }
  return value;
}
