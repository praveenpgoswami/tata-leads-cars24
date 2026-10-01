/**
 * Paginated preview table of parsed lead rows.
 *
 * Exports: `PAGE_SIZE`, `LeadTable`.
 * Notes: Sticky header inside a scroll container, 50 rows per page, filter by status.
 * Invalid cells are tinted and show their reason inline. Both the original Excel city
 * and the mapped active city are shown.
 */
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { DEFAULT_AREA_ID } from "@/config/oem-defaults";
import type { ExcelHeader } from "@/config/excel-layout";
import { effectiveStatus } from "@/lib/excel/row-state";
import { ROW_STATUS_LABELS, ROW_STATUSES, type LeadRow, type RowStatus } from "@/lib/excel/types";
import type { Mode } from "@/lib/validation/api-schemas";
import { StatusBadge } from "./StatusBadge";

export const PAGE_SIZE = 50;

type Filter = RowStatus | "all";

interface LeadTableProps {
  rows: readonly LeadRow[];
  mode: Mode;
  counts: Readonly<Record<RowStatus, number>>;
}

const TH = "sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700";
const TD = "border-b border-gray-100 px-3 py-2 align-top";

const ERROR_TONE = {
  invalid: { cell: "bg-red-50", text: "text-red-700" },
  unmapped: { cell: "bg-amber-50", text: "text-amber-900" },
} as const;

/** A non-blank city that failed to map is an "unmapped" problem (amber), not invalid (red). */
function errorTone(row: LeadRow, field: ExcelHeader): (typeof ERROR_TONE)[keyof typeof ERROR_TONE] {
  if (field === "customerCitySlug" && row.cells.customerCitySlug && !row.cityMatch) {
    return ERROR_TONE.unmapped;
  }
  return ERROR_TONE.invalid;
}

/** A data cell that shows its validation error, if any. */
function FieldCell({ row, field, children }: { row: LeadRow; field: ExcelHeader; children?: ReactNode }) {
  const error = row.errors[field];
  const tone = errorTone(row, field);
  return (
    <td className={cn(TD, error && tone.cell)}>
      <div className="text-gray-900">{children ?? (row.cells[field] || <span className="text-gray-400">(blank)</span>)}</div>
      {error && <div className={cn("mt-0.5 max-w-64 text-xs", tone.text)}>{error}</div>}
    </td>
  );
}

function ModelValue({ row }: { row: LeadRow }) {
  return (
    <>
      {row.cells.modelSlug || <span className="text-gray-400">(blank)</span>}
      {row.model && <div className="text-xs text-gray-600">{row.model.name}</div>}
    </>
  );
}

function AreaValue({ row }: { row: LeadRow }) {
  if (row.cells.areaName) {
    return <>{row.cells.areaName}</>;
  }
  return <span className="text-gray-600">{DEFAULT_AREA_ID} (default)</span>;
}

function MappedCity({ row }: { row: LeadRow }) {
  if (row.cityMatch) {
    return (
      <td className={TD}>
        <div className="text-gray-900">{row.cityMatch.name}</div>
        <div className="text-xs text-gray-600">{row.cityMatch.slug}</div>
      </td>
    );
  }
  if (!row.cells.customerCitySlug) {
    return <td className={cn(TD, "text-gray-400")}>n/a</td>;
  }
  return <td className={cn(TD, "font-medium text-amber-900")}>Not mapped</td>;
}

/** Filterable, paginated table of rows. */
export function LeadTable({ rows, mode, counts }: LeadTableProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const filtered = rows.filter((row) => filter === "all" || effectiveStatus(row, mode) === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Show
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as Filter);
              setPage(0);
            }}
            className="h-8 rounded border border-gray-300 bg-white px-2 text-sm focus:border-blue-700 focus:outline-none"
          >
            <option value="all">All rows ({rows.length})</option>
            {ROW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ROW_STATUS_LABELS[status]} ({counts[status]})
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="tabular-nums">
            {filtered.length === 0 && "No rows"}
            {filtered.length > 0 && `Rows ${start + 1}–${start + visible.length} of ${filtered.length}`}
          </span>
          <Button
            size="sm"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button
            size="sm"
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className={cn(TH, "w-16")}>
                Row
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                Mobile
              </th>
              <th scope="col" className={TH}>
                Customer name
              </th>
              <th scope="col" className={TH}>
                Model
              </th>
              <th scope="col" className={TH}>
                City (Excel)
              </th>
              <th scope="col" className={TH}>
                Mapped city
              </th>
              <th scope="col" className={TH}>
                Area ID
              </th>
              <th scope="col" className={TH}>
                Pincode
              </th>
              <th scope="col" className={cn(TH, "min-w-56")}>
                OEM response
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.rowNumber} className="hover:bg-gray-50">
                <td className={cn(TD, "text-gray-600 tabular-nums")}>{row.rowNumber}</td>
                <td className={TD}>
                  <StatusBadge status={effectiveStatus(row, mode)} devSend={row.sentMode === "dev"} />
                </td>
                <FieldCell row={row} field="mobile" />
                <FieldCell row={row} field="customerName" />
                <FieldCell row={row} field="modelSlug">
                  <ModelValue row={row} />
                </FieldCell>
                <FieldCell row={row} field="customerCitySlug" />
                <MappedCity row={row} />
                <FieldCell row={row} field="areaName">
                  <AreaValue row={row} />
                </FieldCell>
                <FieldCell row={row} field="pincode" />
                <td className={cn(TD, "text-xs break-words text-gray-700")}>{row.message}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-600">
                  No rows match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
