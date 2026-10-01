/**
 * Structure check for the uploaded sheet's header row.
 *
 * Exports: `HeaderValidation`, `validateHeaders()`, `describeHeaderProblems()`.
 *
 * Notes: Headers must match `EXPECTED_HEADERS` exactly (after trimming), with no extra
 * or duplicate columns, in the expected order. Trailing empty header cells are ignored;
 * an empty header between real columns counts as an extra column.
 */
import { EXPECTED_HEADERS } from "@/config/excel-layout";

export interface HeaderValidation {
  readonly ok: boolean;
  readonly missing: string[];
  readonly extra: string[];
  readonly duplicates: string[];
  readonly misordered: string[];
}

/** Converts a header cell to trimmed text. */
function headerText(cell: unknown): string {
  if (typeof cell === "string") {
    return cell.trim();
  }
  if (typeof cell === "number" || typeof cell === "boolean") {
    return String(cell);
  }
  return "";
}

/**
 * Compares the actual header row with the expected headers.
 * @param actualRow raw header cells from row 1.
 * @param expected expected headers in order (defaults to the Excel layout config).
 */
export function validateHeaders(
  actualRow: readonly unknown[],
  expected: readonly string[] = EXPECTED_HEADERS,
): HeaderValidation {
  const actual = actualRow.map(headerText);
  while (actual.length > 0 && actual[actual.length - 1] === "") {
    actual.pop();
  }

  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((header) => !actualSet.has(header));

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const extra: string[] = [];
  actual.forEach((header, index) => {
    if (header === "") {
      extra.push(`(blank header in column ${index + 1})`);
      return;
    }
    if (!expectedSet.has(header)) {
      extra.push(header);
      return;
    }
    if (seen.has(header)) {
      duplicates.push(header);
    }
    seen.add(header);
  });

  const expectedPresent = expected.filter((header) => actualSet.has(header));
  const actualOrder = [...new Set(actual.filter((header) => expectedSet.has(header)))];
  const misordered = expectedPresent.filter((header, index) => actualOrder[index] !== header);

  const ok = missing.length + extra.length + duplicates.length + misordered.length === 0;
  return { ok, missing, extra, duplicates, misordered };
}

/** Turns a failed header check into user-facing lines. */
export function describeHeaderProblems(result: HeaderValidation): string[] {
  const lines: string[] = [];
  if (result.missing.length > 0) {
    lines.push(`Missing columns: ${result.missing.join(", ")}`);
  }
  if (result.extra.length > 0) {
    lines.push(`Unexpected columns: ${result.extra.join(", ")}`);
  }
  if (result.duplicates.length > 0) {
    lines.push(`Duplicate columns: ${result.duplicates.join(", ")}`);
  }
  if (result.misordered.length > 0) {
    lines.push(`Columns out of order: ${result.misordered.join(", ")}`);
  }
  lines.push(`Expected exactly, in order: ${EXPECTED_HEADERS.join(", ")}`);
  return lines;
}
