/**
 * Validation and normalisation of one Excel lead row. Shared by the browser preview and
 * the send route handler, so both apply identical rules.
 *
 * Exports:
 * - `NormalizedLead`: validated values ready for payload mapping.
 * - `FieldErrors`, `LeadValidation`, `LeadValidationStatus`.
 * - `leadCellsInputSchema`: zod schema for raw cells arriving at the API.
 * - `resolveModel()`: model ID or name → OEM model.
 * - `validateLeadCells()`: validates a row and maps its city.
 *
 * Notes: Rules come from docs/Excel sheet screenshot.jpeg and the API doc's mandatory
 * fields. Mobile: 10 digits starting 6–9, with one optional leading 0 (stripped).
 * Blank areaName defaults to 2 (API doc).
 */
import { z } from "zod";
import { DEFAULT_AREA_ID } from "@/config/oem-defaults";
import { EXPECTED_HEADERS, type ExcelHeader, type LeadCells } from "@/config/excel-layout";
import { MODEL_NAME_ALIASES, TATA_MODELS, type OemModel } from "@/config/models";
import { matchCity, type CityMatch } from "@/lib/cities/match-city";

const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const PINCODE_PATTERN = /^[1-9]\d{5}$/;
const DIGITS_ONLY = /^\d+$/;
const MAX_CELL_LENGTH = 200;

export interface NormalizedLead {
  readonly customerNumber: string;
  readonly customerName: string;
  readonly interestedModelId: number;
  readonly customerCitySlug: string;
  readonly customerAreaId: number;
  readonly pinCode: number;
}

export type FieldErrors = Partial<Record<ExcelHeader, string>>;

export type LeadValidationStatus = "valid" | "invalid" | "unmapped";

export interface LeadValidation {
  readonly status: LeadValidationStatus;
  readonly lead: NormalizedLead | null;
  readonly errors: FieldErrors;
  readonly cityMatch: CityMatch | null;
  readonly model: OemModel | null;
}

/** Raw cells as received by the API: every header, as a bounded string. */
export const leadCellsInputSchema = z.object(
  Object.fromEntries(EXPECTED_HEADERS.map((header) => [header, z.string().max(MAX_CELL_LENGTH)])) as Record<
    ExcelHeader,
    z.ZodString
  >,
);

const modelKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const modelsById = new Map(TATA_MODELS.map((model) => [model.id, model]));
const modelsByKey = new Map<string, OemModel>([
  ...TATA_MODELS.map((model): [string, OemModel] => [modelKey(model.name), model]),
  ...Object.entries(MODEL_NAME_ALIASES).flatMap(([alias, id]): Array<[string, OemModel]> => {
    const model = modelsById.get(id);
    if (!model) {
      return [];
    }
    return [[modelKey(alias), model]];
  }),
]);

/**
 * Resolves the Excel model cell (an ID like "1188" or a name like "Harrier EV").
 * @returns the OEM model, or null when unknown.
 */
export function resolveModel(value: string): OemModel | null {
  const trimmed = value.trim();
  if (DIGITS_ONLY.test(trimmed)) {
    return modelsById.get(Number(trimmed)) ?? null;
  }
  return modelsByKey.get(modelKey(trimmed)) ?? null;
}

/** Strips exactly one leading 0 from an 11-digit number ("09812098765" → "9812098765"). */
function stripOneLeadingZero(value: string): string {
  if (value.length === 11 && value.startsWith("0")) {
    return value.slice(1);
  }
  return value;
}

const modelHint = TATA_MODELS.map((model) => `${model.id} ${model.name}`).join(", ");

const rowSchema = z.object({
  mobile: z.string().transform((value, ctx) => {
    const compact = value.replace(/[\s-]/g, "");
    if (!compact) {
      ctx.addIssue({ code: "custom", message: "Mobile is required" });
      return z.NEVER;
    }
    const digits = stripOneLeadingZero(compact);
    if (!MOBILE_PATTERN.test(digits)) {
      ctx.addIssue({
        code: "custom",
        message: "Mobile must be 10 digits starting with 6–9 (one leading 0 is allowed)",
      });
      return z.NEVER;
    }
    return digits;
  }),
  customerName: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, "Customer name is required")
        .max(100, "Customer name must be at most 100 characters")
        .regex(/\p{L}/u, "Customer name must contain letters"),
    ),
  modelSlug: z.string().transform((value, ctx) => {
    if (!value.trim()) {
      ctx.addIssue({ code: "custom", message: "Model is required" });
      return z.NEVER;
    }
    const model = resolveModel(value);
    if (!model) {
      ctx.addIssue({ code: "custom", message: `Unknown model. Use an ID or name: ${modelHint}` });
      return z.NEVER;
    }
    return model.id;
  }),
  customerCitySlug: z.string().trim().min(1, "City is required"),
  areaName: z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return DEFAULT_AREA_ID;
    }
    const areaId = Number(trimmed);
    if (!DIGITS_ONLY.test(trimmed) || areaId < 1 || areaId > 999_999_999) {
      ctx.addIssue({ code: "custom", message: `Area ID must be a positive whole number (blank = ${DEFAULT_AREA_ID})` });
      return z.NEVER;
    }
    return areaId;
  }),
  pincode: z.string().transform((value, ctx) => {
    const trimmed = value.trim();
    if (!trimmed) {
      ctx.addIssue({ code: "custom", message: "Pincode is required" });
      return z.NEVER;
    }
    if (!PINCODE_PATTERN.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: "Pincode must be 6 digits and not start with 0" });
      return z.NEVER;
    }
    return Number(trimmed);
  }),
});

function isExcelHeader(value: PropertyKey | undefined): value is ExcelHeader {
  return typeof value === "string" && (EXPECTED_HEADERS as readonly string[]).includes(value);
}

/**
 * Validates one row of cells and maps its city.
 * @returns status "invalid" for field errors, "unmapped" when only the city is unknown,
 * otherwise "valid" with a normalised lead.
 */
export function validateLeadCells(cells: LeadCells): LeadValidation {
  const errors: FieldErrors = {};
  const parsed = rowSchema.safeParse(cells);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (isExcelHeader(field) && !errors[field]) {
        errors[field] = issue.message;
      }
    }
  }

  const cityText = cells.customerCitySlug.trim();
  const cityMatch = matchCity(cityText);
  const model = resolveModel(cells.modelSlug);

  if (cityText && !cityMatch) {
    errors.customerCitySlug = `City "${cityText}" is not in the active city list`;
  }

  if (!parsed.success) {
    return { status: "invalid", lead: null, errors, cityMatch, model };
  }
  if (!cityMatch) {
    return { status: "unmapped", lead: null, errors, cityMatch, model };
  }

  const data = parsed.data;
  return {
    status: "valid",
    lead: {
      customerNumber: data.mobile,
      customerName: data.customerName,
      interestedModelId: data.modelSlug,
      customerCitySlug: cityMatch.slug,
      customerAreaId: data.areaName,
      pinCode: data.pincode,
    },
    errors,
    cityMatch,
    model,
  };
}
