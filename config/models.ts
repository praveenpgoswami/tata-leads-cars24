/**
 * Tata model and make IDs for the OEM API.
 *
 * Exports: `TATA_MAKE_ID`, `OemModel`, `TATA_MODELS`, `MODEL_NAME_ALIASES`.
 *
 * Notes: The IDs come from docs/Adtrafix - lead contract tata api doc.docx, sections
 * "Model Id mapping" and "Make Id mapping". The Excel `modelSlug` column may hold an ID
 * or a model name; names are matched case-insensitively, ignoring spaces and
 * punctuation ("Nexon EV" = "nexon-ev" = "NexonEV").
 */

/** "Make Id mapping: Tata - 69". */
export const TATA_MAKE_ID = 69;

export interface OemModel {
  readonly id: number;
  /** Display name as written in the API doc. */
  readonly name: string;
}

/** "Model Id mapping" from the API doc. */
export const TATA_MODELS: readonly OemModel[] = [
  { id: 1523, name: "PunchEV" },
  { id: 1372, name: "NexonEV" },
  { id: 1188, name: "Harrier EV" },
  { id: 1148, name: "Tiago EV" },
  { id: 1348, name: "Curvv EV" },
  { id: 1480, name: "Sierra" },
];

/**
 * Extra spellings → model ID. Keys are compared after removing everything except
 * letters and digits and lower-casing. Add entries here as new spellings show up.
 * Do not alias bare names like "Nexon" or "Punch": those are also petrol/diesel models,
 * and only the EV IDs are listed in the doc.
 * @example { "curvvelectric": 1348 }
 */
export const MODEL_NAME_ALIASES: Readonly<Record<string, number>> = {};
