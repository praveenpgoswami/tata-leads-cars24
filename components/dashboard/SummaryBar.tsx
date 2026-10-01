/**
 * Summary counts above the preview table.
 *
 * Exports: `SummaryBar`.
 */
import { cn } from "@/components/ui/cn";
import { ROW_STATUS_LABELS, type RowStatus } from "@/lib/excel/types";

const SHOWN: readonly RowStatus[] = ["valid", "invalid", "unmapped", "sent", "failed"];

const ACCENT: Readonly<Record<RowStatus, string>> = {
  valid: "text-green-800",
  invalid: "text-red-800",
  unmapped: "text-amber-900",
  sending: "text-blue-800",
  sent: "text-green-800",
  failed: "text-red-800",
};

interface SummaryBarProps {
  total: number;
  counts: Readonly<Record<RowStatus, number>>;
}

/** Total plus per-status counts. */
export function SummaryBar({ total, counts }: SummaryBarProps) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-gray-200 rounded-md border border-gray-200 bg-white sm:grid-cols-6">
      <div className="px-4 py-3">
        <dt className="text-xs text-gray-600">Total rows</dt>
        <dd className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">{total}</dd>
      </div>
      {SHOWN.map((status) => (
        <div key={status} className="px-4 py-3">
          <dt className="text-xs text-gray-600">{ROW_STATUS_LABELS[status]}</dt>
          <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums", ACCENT[status])}>{counts[status]}</dd>
        </div>
      ))}
    </dl>
  );
}
