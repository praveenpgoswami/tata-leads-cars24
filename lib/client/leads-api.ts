/**
 * Browser-side wrapper for POST /api/leads/send.
 *
 * Exports: `BatchOutcome`, `postSendBatch()`.
 * Notes: Validates the server response with zod before the UI uses it.
 */
import type { LeadCells } from "@/config/excel-layout";
import { sendResponseSchema, type Mode, type SendRowResult } from "@/lib/validation/api-schemas";

export type BatchOutcome =
  | { readonly kind: "ok"; readonly results: SendRowResult[] }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "error"; readonly message: string };

/** Sends one batch and returns a typed outcome; never throws. */
export async function postSendBatch(
  mode: Mode,
  rows: ReadonlyArray<{ rowNumber: number; cells: LeadCells }>,
): Promise<BatchOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/leads/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, rows }),
    });
  } catch {
    return { kind: "error", message: "Could not reach the server. Check your connection, then retry the failed rows." };
  }
  if (response.status === 401) {
    return { kind: "unauthorized" };
  }
  if (!response.ok) {
    return { kind: "error", message: `Server error (HTTP ${response.status}). Retry the failed rows.` };
  }
  const parsed = sendResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return { kind: "error", message: "Unexpected server response." };
  }
  return { kind: "ok", results: parsed.data.results };
}
