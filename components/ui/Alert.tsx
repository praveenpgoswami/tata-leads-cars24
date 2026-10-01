/**
 * Inline message box for errors, warnings and notices.
 *
 * Exports: `AlertTone`, `Alert`.
 */
import { AlertTriangle, CircleCheck, Info, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "error" | "warning" | "success" | "info";

const TONES: Readonly<Record<AlertTone, { className: string; icon: LucideIcon; role: "alert" | "status" }>> = {
  error: { className: "border-red-200 bg-red-50 text-red-900", icon: XCircle, role: "alert" },
  warning: { className: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle, role: "alert" },
  success: { className: "border-green-200 bg-green-50 text-green-900", icon: CircleCheck, role: "status" },
  info: { className: "border-blue-200 bg-blue-50 text-blue-900", icon: Info, role: "status" },
};

interface AlertProps {
  tone: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/** Bordered message with an icon and optional title. */
export function Alert({ tone, title, children, className }: AlertProps) {
  const config = TONES[tone];
  const Icon = config.icon;
  return (
    <div role={config.role} className={cn("flex gap-3 rounded border px-4 py-3 text-sm", config.className, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
