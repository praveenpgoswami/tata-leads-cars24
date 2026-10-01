/**
 * Shared types for parsed Excel rows in the preview.
 *
 * Exports: `RowStatus`, `ROW_STATUSES`, `ROW_STATUS_LABELS`, `RawLeadRow`, `LeadRow`.
 */
import type { LeadCells } from "@/config/excel-layout";
import type { CityMatch } from "@/lib/cities/match-city";
import type { FieldErrors } from "@/lib/validation/lead-row";
import type { OemModel } from "@/config/models";
import type { Mode } from "@/lib/validation/api-schemas";

export const ROW_STATUSES = ["valid", "invalid", "unmapped", "sending", "sent", "failed"] as const;

export type RowStatus = (typeof ROW_STATUSES)[number];

/** A data row as read from the sheet, before validation. */
export interface RawLeadRow {
  /** 1-based Excel row number (the header row is row 1). */
  readonly rowNumber: number;
  readonly cells: LeadCells;
}

/** A validated row shown in the preview table. */
export interface LeadRow extends RawLeadRow {
  readonly status: RowStatus;
  readonly errors: FieldErrors;
  readonly cityMatch: CityMatch | null;
  readonly model: OemModel | null;
  /** OEM response message or send error, empty until sent. */
  readonly message: string;
  /** Mode the row was sent in; a DEV send doesn't block a later LIVE send. */
  readonly sentMode: Mode | null;
}

/** User-facing label for each row status (always shown next to any status colour). */
export const ROW_STATUS_LABELS: Readonly<Record<RowStatus, string>> = {
  valid: "Valid",
  invalid: "Invalid",
  unmapped: "Unmapped city",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};
