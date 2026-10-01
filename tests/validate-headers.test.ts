/**
 * Tests for header (structure) validation (lib/excel/validate-headers.ts).
 */
import { describe, expect, it } from "vitest";
import { EXPECTED_HEADERS } from "@/config/excel-layout";
import { describeHeaderProblems, validateHeaders } from "@/lib/excel/validate-headers";

const exact = [...EXPECTED_HEADERS];

describe("validateHeaders", () => {
  it("accepts the exact headers from the screenshot", () => {
    expect(validateHeaders(exact).ok).toBe(true);
  });

  it("ignores surrounding whitespace and trailing empty cells", () => {
    expect(validateHeaders([" mobile ", ...exact.slice(1), "", ""]).ok).toBe(true);
  });

  it("reports missing columns without flagging the rest as misordered", () => {
    const result = validateHeaders(exact.filter((h) => h !== "areaName"));
    expect(result).toMatchObject({ ok: false, missing: ["areaName"], extra: [], misordered: [] });
  });

  it("reports extra and blank columns", () => {
    const result = validateHeaders([
      "mobile",
      "email",
      "customerName",
      "",
      "modelSlug",
      "customerCitySlug",
      "areaName",
      "pincode",
    ]);
    expect(result.extra).toEqual(["email", "(blank header in column 4)"]);
    expect(result.misordered).toEqual([]);
  });

  it("reports swapped columns as misordered", () => {
    const result = validateHeaders(["customerName", "mobile", "modelSlug", "customerCitySlug", "areaName", "pincode"]);
    expect(result.misordered).toEqual(["mobile", "customerName"]);
    expect(result.ok).toBe(false);
  });

  it("is case-sensitive and flags duplicates", () => {
    const result = validateHeaders(["Mobile", ...exact.slice(1), "pincode"]);
    expect(result.missing).toEqual(["mobile"]);
    expect(result.extra).toEqual(["Mobile"]);
    expect(result.duplicates).toEqual(["pincode"]);
  });

  it("describes problems with the expected header list", () => {
    const lines = describeHeaderProblems(validateHeaders(["mobile"]));
    expect(lines[0]).toContain("Missing columns: customerName");
    expect(lines.at(-1)).toContain(EXPECTED_HEADERS.join(", "));
  });
});
