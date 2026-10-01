/**
 * Expected Excel upload layout and upload limits.
 *
 * Exports: `EXPECTED_HEADERS`, `ExcelHeader`, `LeadCells`, `HEADER_LABELS`,
 * `ACCEPTED_EXTENSIONS`, `MAX_FILE_BYTES`, `MAX_ROWS`.
 *
 * Notes: The headers come from docs/Excel sheet screenshot.jpeg (row 1, columns A–F),
 * with the two cut-off names confirmed by the business owner. Comparison is exact
 * (after trimming) and order-sensitive. Data is read from the first sheet.
 */

/** Required headers, exactly and in this order. */
export const EXPECTED_HEADERS = [
  "mobile",
  "customerName",
  "modelSlug",
  "customerCitySlug",
  "areaName",
  "pincode",
] as const;

export type ExcelHeader = (typeof EXPECTED_HEADERS)[number];

/** One Excel data row as display strings, keyed by header. */
export type LeadCells = Record<ExcelHeader, string>;

/** Human-readable column labels for the preview table and messages. */
export const HEADER_LABELS: Readonly<Record<ExcelHeader, string>> = {
  mobile: "Mobile",
  customerName: "Customer name",
  modelSlug: "Model",
  customerCitySlug: "City",
  areaName: "Area ID",
  pincode: "Pincode",
};

export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"] as const;

/** Upload size cap; parsing happens in the browser so this only protects the tab. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Maximum data rows per file. */
export const MAX_ROWS = 5000;
