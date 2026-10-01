/**
 * Tests for preview row state transitions (lib/excel/row-state.ts): double-send
 * prevention and DEV → LIVE behaviour.
 */
import { describe, expect, it } from "vitest";
import { validateRows } from "@/lib/excel/parse";
import {
  applySendResults,
  countByStatus,
  effectiveStatus,
  isSendable,
  markSending,
  resetFailed,
  revertSending,
} from "@/lib/excel/row-state";

const base = validateRows([
  {
    rowNumber: 2,
    cells: { mobile: "8823098494", customerName: "Rama", modelSlug: "1188", customerCitySlug: "new-delhi", areaName: "2", pincode: "110003" },
  },
  {
    rowNumber: 3,
    cells: { mobile: "9991879860", customerName: "karan", modelSlug: "1348", customerCitySlug: "gurgaon", areaName: "2", pincode: "122001" },
  },
  {
    rowNumber: 4,
    cells: { mobile: "", customerName: "x", modelSlug: "1348", customerCitySlug: "gurgaon", areaName: "2", pincode: "122001" },
  },
]);

const result = (rowNumber: number, status: "sent" | "failed", dryRun = false) => ({
  rowNumber,
  status,
  message: "m",
  httpStatus: 200,
  dryRun,
});

describe("row state", () => {
  it("rows sent in LIVE are never sendable again", () => {
    const rows = applySendResults(markSending(base, new Set([2])), [result(2, "sent")], "live");
    expect(rows[0]?.status).toBe("sent");
    expect(isSendable(rows[0]!, "live")).toBe(false);
    expect(isSendable(rows[0]!, "dev")).toBe(false);
    expect(rows.filter((row) => isSendable(row, "live")).map((row) => row.rowNumber)).toEqual([3]);
  });

  it("rows sent in DEV become sendable again in LIVE only", () => {
    const rows = applySendResults(base, [result(2, "sent", true)], "dev");
    expect(effectiveStatus(rows[0]!, "dev")).toBe("sent");
    expect(effectiveStatus(rows[0]!, "live")).toBe("valid");
    expect(countByStatus(rows, "live")).toMatchObject({ valid: 2, invalid: 1, sent: 0 });
  });

  it("failed rows can be reset for retry; invalid rows stay invalid", () => {
    const failed = applySendResults(base, [result(2, "failed"), result(3, "failed")], "live");
    expect(countByStatus(failed, "live").failed).toBe(2);
    const reset = resetFailed(failed);
    expect(reset.map((row) => row.status)).toEqual(["valid", "valid", "invalid"]);
  });

  it("revertSending returns in-flight rows to valid", () => {
    expect(revertSending(markSending(base, new Set([2, 3]))).map((row) => row.status)).toEqual([
      "valid",
      "valid",
      "invalid",
    ]);
  });
});
