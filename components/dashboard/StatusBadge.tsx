/**
 * Row status badge: muted colour, always with a text label.
 *
 * Exports: `STATUS_STYLES`, `StatusBadge`.
 */
import { AlertTriangle, Check, Circle, Loader2, MapPinOff, X, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { ROW_STATUS_LABELS, type RowStatus } from "@/lib/excel/types";

export const STATUS_STYLES: Readonly<Record<RowStatus, { className: string; icon: LucideIcon; spin?: boolean }>> = {
  valid: { className: "border-green-300 bg-white text-green-800", icon: Circle },
  invalid: { className: "border-red-200 bg-red-50 text-red-800", icon: X },
  unmapped: { className: "border-amber-200 bg-amber-50 text-amber-900", icon: MapPinOff },
  sending: { className: "border-blue-200 bg-blue-50 text-blue-800", icon: Loader2, spin: true },
  sent: { className: "border-green-200 bg-green-50 text-green-800", icon: Check },
  failed: { className: "border-red-300 bg-red-50 text-red-800", icon: AlertTriangle },
};

/** Label text; a row sent in DEV says so, so it can't be mistaken for a delivered lead. */
function badgeLabel(status: RowStatus, devSend: boolean): string {
  if (status === "sent" && devSend) {
    return "Sent (DEV)";
  }
  return ROW_STATUS_LABELS[status];
}

/** Compact status label with an icon. */
export function StatusBadge({ status, devSend = false }: { status: RowStatus; devSend?: boolean }) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <Icon aria-hidden className={cn("size-3", style.spin && "animate-spin")} />
      {badgeLabel(status, devSend)}
    </span>
  );
}
