/**
 * Button with a small set of visual variants.
 *
 * Exports: `ButtonVariant`, `Button`.
 */
import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-blue-800 bg-blue-800 text-white hover:bg-blue-900 hover:border-blue-900",
  secondary: "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-800 hover:border-red-800",
  ghost: "border-transparent bg-transparent text-gray-700 hover:bg-gray-100",
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
};

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Standard button. Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded border font-medium whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
