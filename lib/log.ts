/**
 * Structured JSON logging for Vercel logs.
 *
 * Exports: `LogFields`, `logEvent()`, `maskPhone()`.
 *
 * Notes: Never pass tokens, names or full phone numbers. Use `maskPhone()` for numbers.
 */

export type LogFields = Readonly<Record<string, string | number | boolean | null>>;

/** Writes one JSON line: `{ ts, level, event, ...fields }`. */
export function logEvent(event: string, fields: LogFields = {}, level: "info" | "warn" | "error" = "info"): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  const writers: Record<typeof level, (message: string) => void> = {
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  writers[level](line);
}

/** Masks all but the last 4 digits: "9812098765" → "******8765". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "****";
  }
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}
