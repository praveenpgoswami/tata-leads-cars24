/**
 * Browser-side Excel parsing with SheetJS.
 *
 * Exports: `ParseOutcome`, `cellToText()`, `parseLeadWorkbook()`, `validateRows()`.
 *
 * Notes: Files are parsed in the browser and never uploaded, which keeps them clear of
 * Vercel's request body limit. Only the first sheet is read. Fully blank rows are
 * skipped, but row numbers still refer to the original Excel rows. SheetJS is large, so
 * load this module with a dynamic import.
 */
import * as XLSX from "xlsx";
import { EXPECTED_HEADERS, MAX_ROWS, type LeadCells } from "@/config/excel-layout";
import { validateLeadCells } from "@/lib/validation/lead-row";
import type { LeadRow, RawLeadRow } from "./types";
import { describeHeaderProblems, validateHeaders } from "./validate-headers";

export type ParseOutcome =
  | { readonly kind: "structure-error"; readonly problems: string[] }
  | { readonly kind: "ok"; readonly sheetName: string; readonly rows: RawLeadRow[] };

/**
 * Converts a raw SheetJS cell value to trimmed display text. Numbers such as mobile
 * numbers stored as numeric cells become their plain digits.
 */
export function cellToText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 });
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return "";
}

const structureError = (...problems: string[]): ParseOutcome => ({ kind: "structure-error", problems });

/**
 * Parses a workbook and checks its structure.
 * @param data file contents.
 * @returns the data rows, or a structure error describing what is wrong.
 */
export function parseLeadWorkbook(data: ArrayBuffer): ParseOutcome {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", cellDates: false, dense: true });
  } catch {
    return structureError("The file could not be read. Make sure it is a valid .xlsx or .xls workbook.");
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName && workbook.Sheets[sheetName];
  if (!sheetName || !sheet || !sheet["!ref"]) {
    return structureError("The workbook has no data in its first sheet.");
  }

  const startRow = XLSX.utils.decode_range(sheet["!ref"]).s.r;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true });
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow) {
    return structureError("The first sheet is empty.");
  }

  const headerCheck = validateHeaders(headerRow);
  if (!headerCheck.ok) {
    return structureError(...describeHeaderProblems(headerCheck));
  }

  const rows: RawLeadRow[] = [];
  dataRows.forEach((cellsArray, index) => {
    const texts = EXPECTED_HEADERS.map((_, column) => cellToText(cellsArray[column]));
    if (texts.every((text) => text === "")) {
      return;
    }
    const cells = Object.fromEntries(EXPECTED_HEADERS.map((header, column) => [header, texts[column] ?? ""])) as LeadCells;
    rows.push({ rowNumber: startRow + index + 2, cells });
  });

  if (rows.length === 0) {
    return structureError("The sheet has the right headers but no data rows.");
  }
  if (rows.length > MAX_ROWS) {
    return structureError(
      `The sheet has ${rows.length.toLocaleString("en-IN")} data rows; the maximum is ${MAX_ROWS.toLocaleString("en-IN")}. Split the file and upload each part separately.`,
    );
  }
  return { kind: "ok", sheetName, rows };
}

/** Validates every parsed row for the preview table. */
export function validateRows(rows: readonly RawLeadRow[]): LeadRow[] {
  return rows.map((row) => {
    const result = validateLeadCells(row.cells);
    return {
      rowNumber: row.rowNumber,
      cells: row.cells,
      status: result.status,
      errors: result.errors,
      cityMatch: result.cityMatch,
      model: result.model,
      message: "",
      sentMode: null,
    };
  });
}
