/**
 * Pure helpers for preview row state during sending.
 *
 * Exports: `effectiveStatus()`, `isSendable()`, `countByStatus()`, `markSending()`,
 * `applySendResults()`, `markBatchFailed()`, `revertSending()`, `resetFailed()`.
 *
 * Notes: A row sent in DEV (dry run or UAT) counts as "valid" again once the mode is
 * LIVE, so testing in DEV never blocks a real send. A row sent in LIVE is never sent
 * again.
 */
import type { Mode, SendRowResult } from "@/lib/validation/api-schemas";
import { ROW_STATUSES, type LeadRow, type RowStatus } from "./types";

/** Status as shown and acted on in the given mode. */
export function effectiveStatus(row: LeadRow, mode: Mode): RowStatus {
  if (row.status === "sent" && row.sentMode === "dev" && mode === "live") {
    return "valid";
  }
  return row.status;
}

/** True when the row should be included in the next send. */
export function isSendable(row: LeadRow, mode: Mode): boolean {
  return effectiveStatus(row, mode) === "valid";
}

/** Counts rows per effective status. */
export function countByStatus(rows: readonly LeadRow[], mode: Mode): Record<RowStatus, number> {
  const counts = Object.fromEntries(ROW_STATUSES.map((status) => [status, 0])) as Record<RowStatus, number>;
  for (const row of rows) {
    counts[effectiveStatus(row, mode)] += 1;
  }
  return counts;
}

function patchRows(
  rows: readonly LeadRow[],
  rowNumbers: ReadonlySet<number>,
  patch: (row: LeadRow) => LeadRow,
): LeadRow[] {
  return rows.map((row) => {
    if (!rowNumbers.has(row.rowNumber)) {
      return row;
    }
    return patch(row);
  });
}

/** Marks rows as in flight. */
export function markSending(rows: readonly LeadRow[], rowNumbers: ReadonlySet<number>): LeadRow[] {
  return patchRows(rows, rowNumbers, (row) => ({ ...row, status: "sending", message: "" }));
}

/** Applies per-row server results. */
export function applySendResults(rows: readonly LeadRow[], results: readonly SendRowResult[], mode: Mode): LeadRow[] {
  const byRow = new Map(results.map((result) => [result.rowNumber, result]));
  return patchRows(rows, new Set(byRow.keys()), (row) => {
    const result = byRow.get(row.rowNumber);
    if (!result) {
      return row;
    }
    if (result.status === "sent") {
      return { ...row, status: "sent", message: result.message, sentMode: mode };
    }
    return { ...row, status: "failed", message: result.message, sentMode: null };
  });
}

/** Marks a whole batch as failed (for example, when the request itself failed). */
export function markBatchFailed(rows: readonly LeadRow[], rowNumbers: ReadonlySet<number>, message: string): LeadRow[] {
  return patchRows(rows, rowNumbers, (row) => ({ ...row, status: "failed", message, sentMode: null }));
}

/** Returns rows that were in flight to "valid" (for example, after the session expired). */
export function revertSending(rows: readonly LeadRow[]): LeadRow[] {
  return rows.map((row) => {
    if (row.status !== "sending") {
      return row;
    }
    return { ...row, status: "valid" };
  });
}

/** Makes failed rows sendable again, clearing their messages. */
export function resetFailed(rows: readonly LeadRow[]): LeadRow[] {
  return rows.map((row) => {
    if (row.status !== "failed" || Object.keys(row.errors).length > 0) {
      return row;
    }
    return { ...row, status: "valid", message: "" };
  });
}
