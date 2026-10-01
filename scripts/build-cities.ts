/**
 * Build script: converts `docs/Active Cities.xlsx` into a typed TS module.
 *
 * Usage: `npm run build:cities`
 * Output: `lib/cities/active-cities.generated.ts` (commit it; the app never reads the xlsx).
 *
 * Notes:
 * - Source columns (Sheet1): id, name, slug, latitude, longitude, stateId, isActive.
 * - Only rows with isActive === 1 are kept. The API needs `slug` (customerCitySlug).
 * - Fails on duplicate ids or slugs, or on blank names or slugs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";

const SOURCE = resolve("docs/Active Cities.xlsx");
const OUTPUT = resolve("lib/cities/active-cities.generated.ts");

const rowSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lower-case kebab-case"),
  isActive: z.coerce.number().int(),
});

function main(): void {
  const workbook = XLSX.read(readFileSync(SOURCE), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`No sheets found in ${SOURCE}`);
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} could not be read`);
  }
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const rows = rawRows.map((row, index) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`Row ${index + 2}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }
    return parsed.data;
  });

  const active = rows.filter((row) => row.isActive === 1);
  assertUnique(active.map((row) => String(row.id)), "id");
  assertUnique(active.map((row) => row.slug), "slug");

  const entries = active
    .map((row) => `  { id: ${row.id}, name: ${JSON.stringify(row.name)}, slug: ${JSON.stringify(row.slug)} },`)
    .join("\n");

  const contents = `/**
 * GENERATED FILE: do not edit. Run \`npm run build:cities\` to regenerate.
 *
 * Source: docs/Active Cities.xlsx (${sheetName}), active rows only.
 * Exports: \`ActiveCity\`, \`ACTIVE_CITIES\` (${active.length} cities).
 */

/** A city accepted by the OEM API; \`slug\` is sent as customerCitySlug. */
export interface ActiveCity {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}

/** All active cities from the OEM city list. */
export const ACTIVE_CITIES: readonly ActiveCity[] = [
${entries}
];
`;
  writeFileSync(OUTPUT, contents, "utf8");
  console.log(`Wrote ${active.length} active cities (of ${rows.length} rows) to ${OUTPUT}`);
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

main();
