/**
 * Builds the downloadable CSV error report (invalid, unmapped and failed rows).
 *
 * Exports: `REPORTED_STATUSES`, `rowReason()`, `buildErrorReportCsv()`.
 *
 * Notes: Cells that start with = + - @ (or a tab or carriage return) get a leading
 * apostrophe so spreadsheet apps don't run them as formulas (CSV injection).
 */
import { EXPECTED_HEADERS, HEADER_LABELS } from "@/config/excel-layout";
import { ROW_STATUS_LABELS, type LeadRow, type RowStatus } from "./types";

export const REPORTED_STATUSES: ReadonlySet<RowStatus> = new Set<RowStatus>(["invalid", "unmapped", "failed"]);

/** One-line reason for a row: its field errors, then any send message. */
export function rowReason(row: LeadRow): string {
  const fieldReasons = EXPECTED_HEADERS.flatMap((header) => {
    const error = row.errors[header];
    if (!error) {
      return [];
    }
    return [`${HEADER_LABELS[header]}: ${error}`];
  });
  if (row.message) {
    fieldReasons.push(row.message);
  }
  return fieldReasons.join("; ");
}

function csvCell(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Returns CSV text for the rows that need attention (a header row is always included). */
export function buildErrorReportCsv(rows: readonly LeadRow[]): string {
  const header = ["Excel row", "Status", "Reason", ...EXPECTED_HEADERS];
  const lines = rows
    .filter((row) => REPORTED_STATUSES.has(row.status))
    .map((row) => [
      String(row.rowNumber),
      ROW_STATUS_LABELS[row.status],
      rowReason(row),
      ...EXPECTED_HEADERS.map((column) => row.cells[column]),
    ]);
  return [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}
