/**
 * Accessible progress bar for batch sending.
 *
 * Exports: `ProgressBar`.
 */

interface ProgressBarProps {
  done: number;
  total: number;
  label: string;
}

/** Thin progress bar with a text label (role="progressbar"). */
export function ProgressBar({ done, total, label }: ProgressBarProps) {
  const percent = Math.round((done / Math.max(total, 1)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-gray-700">
        <span>{label}</span>
        <span className="tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-1.5 w-full overflow-hidden rounded-sm bg-gray-200"
      >
        <div className="h-full bg-blue-800 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
