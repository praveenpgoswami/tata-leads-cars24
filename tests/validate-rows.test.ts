/**
 * Tests for row validation (lib/validation/lead-row.ts) and workbook parsing
 * (lib/excel/parse.ts), using rows from docs/Excel sheet screenshot.jpeg.
 */
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { EXPECTED_HEADERS, type LeadCells } from "@/config/excel-layout";
import { buildErrorReportCsv } from "@/lib/excel/error-report";
import { checkUploadFile } from "@/lib/excel/check-file";
import { cellToText, parseLeadWorkbook, validateRows } from "@/lib/excel/parse";
import { resolveModel, validateLeadCells } from "@/lib/validation/lead-row";

const cells = (overrides: Partial<LeadCells> = {}): LeadCells => ({
  mobile: "8823098494",
  customerName: "Rama",
  modelSlug: "1188",
  customerCitySlug: "new-delhi",
  areaName: "2",
  pincode: "110003",
  ...overrides,
});

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("validateLeadCells", () => {
  it("normalises a valid sample row", () => {
    const result = validateLeadCells(cells());
    expect(result.status).toBe("valid");
    expect(result.lead).toEqual({
      customerNumber: "8823098494",
      customerName: "Rama",
      interestedModelId: 1188,
      customerCitySlug: "new-delhi",
      customerAreaId: 2,
      pinCode: 110003,
    });
    expect(result.model?.name).toBe("Harrier EV");
  });

  it("strips exactly one leading 0 and inner spaces from mobile", () => {
    expect(validateLeadCells(cells({ mobile: "09812098765" })).lead?.customerNumber).toBe("9812098765");
    expect(validateLeadCells(cells({ mobile: "98120 98765" })).lead?.customerNumber).toBe("9812098765");
  });

  it.each(["+919812098765", "919812098765", "5812098765", "981209876", "0098120987", "abc"])(
    "rejects mobile %s",
    (mobile) => {
      const result = validateLeadCells(cells({ mobile }));
      expect(result.status).toBe("invalid");
      expect(result.errors.mobile).toMatch(/10 digits/);
    },
  );

  it("accepts model names as well as IDs", () => {
    expect(validateLeadCells(cells({ modelSlug: "Nexon EV" })).lead?.interestedModelId).toBe(1372);
    expect(resolveModel("nexon-ev")?.id).toBe(1372);
    expect(resolveModel("CURVV EV")?.id).toBe(1348);
    expect(resolveModel("Nexon")).toBeNull();
    expect(resolveModel("9999")).toBeNull();
  });

  it("defaults a blank area to 2 and rejects non-numeric areas", () => {
    expect(validateLeadCells(cells({ areaName: "" })).lead?.customerAreaId).toBe(2);
    expect(validateLeadCells(cells({ areaName: "Karol Bagh" })).errors.areaName).toBeDefined();
  });

  it("rejects bad pincodes and blank names", () => {
    const result = validateLeadCells(cells({ pincode: "011000", customerName: "  " }));
    expect(result.status).toBe("invalid");
    expect(Object.keys(result.errors).sort()).toEqual(["customerName", "pincode"]);
  });

  it("marks an unknown city as unmapped when everything else is valid", () => {
    const result = validateLeadCells(cells({ customerCitySlug: "Atlantis" }));
    expect(result.status).toBe("unmapped");
    expect(result.lead).toBeNull();
    expect(result.errors.customerCitySlug).toContain("Atlantis");
  });

  it("maps aliases to the canonical slug in the lead", () => {
    expect(validateLeadCells(cells({ customerCitySlug: "Gurugram" })).lead?.customerCitySlug).toBe("gurgaon");
  });

  it("keeps invalid status (not unmapped) when other fields also fail", () => {
    expect(validateLeadCells(cells({ customerCitySlug: "Atlantis", mobile: "" })).status).toBe("invalid");
  });
});

describe("parseLeadWorkbook", () => {
  const header = [...EXPECTED_HEADERS];

  it("parses the screenshot sample with numeric cells", () => {
    const outcome = parseLeadWorkbook(
      workbookBuffer([
        header,
        [8823098494, "Rama", 1188, "new-delhi", 2, 110003],
        [9991879860, "karan", 1348, "gurgaon", 2, 122001],
        ["", "", "", "", "", ""],
        [9812098765, "Kirti", 1348, "udaipur", 2, 313001],
      ]),
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") {
      return;
    }
    expect(outcome.rows.map((row) => row.rowNumber)).toEqual([2, 3, 5]);
    expect(outcome.rows[0]?.cells.mobile).toBe("8823098494");
    expect(validateRows(outcome.rows).every((row) => row.status === "valid")).toBe(true);
  });

  it("returns a structure error for wrong headers", () => {
    const outcome = parseLeadWorkbook(workbookBuffer([["phone", "name"], [1, 2]]));
    expect(outcome.kind).toBe("structure-error");
  });

  it("returns a structure error when there are no data rows or the file is garbage", () => {
    expect(parseLeadWorkbook(workbookBuffer([header])).kind).toBe("structure-error");
    const garbage = new TextEncoder().encode("not a workbook").buffer as ArrayBuffer;
    expect(parseLeadWorkbook(garbage).kind).toBe("structure-error");
  });
});

describe("helpers", () => {
  it("cellToText prints large integers without exponent or grouping", () => {
    expect(cellToText(9911897324)).toBe("9911897324");
    expect(cellToText("  x ")).toBe("x");
    expect(cellToText(null)).toBe("");
  });

  it("checkUploadFile enforces one Excel file under the size cap", () => {
    expect(checkUploadFile([{ name: "a.xlsx", size: 10 }])).toBeNull();
    expect(checkUploadFile([{ name: "A.XLS", size: 10 }])).toBeNull();
    expect(checkUploadFile([{ name: "a.csv", size: 10 }])).toMatch(/not an Excel file/);
    expect(
      checkUploadFile([
        { name: "a.xlsx", size: 10 },
        { name: "b.xlsx", size: 10 },
      ]),
    ).toMatch(/one file/);
    expect(checkUploadFile([{ name: "a.xlsx", size: 6 * 1024 * 1024 }])).toMatch(/larger than 5 MB/);
  });

  it("error report includes only problem rows and neutralises formulas", () => {
    const rows = validateRows([
      { rowNumber: 2, cells: cells() },
      { rowNumber: 3, cells: cells({ customerName: "=HYPERLINK(1)", mobile: "x" }) },
    ]);
    const csv = buildErrorReportCsv(rows).split("\r\n");
    expect(csv).toHaveLength(2);
    expect(csv[1]).toContain("'=HYPERLINK(1)");
    expect(csv[1]).toMatch(/^3,Invalid,/);
  });
});
