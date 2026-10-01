/**
 * Labelled text input with an inline error message.
 *
 * Exports: `TextField`.
 * Notes: Wires up `aria-invalid` and `aria-describedby` for screen readers.
 */
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
}

/** Text input with a visible label and optional error. */
export function TextField({ label, error, className, ...props }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-800">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={hasError}
        aria-describedby={cn(hasError && errorId) || undefined}
        className={cn(
          "h-9 rounded border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400",
          "focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20",
          hasError && "border-red-600",
          !hasError && "border-gray-300",
          className,
        )}
        {...props}
      />
      {hasError && (
        <p id={errorId} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
