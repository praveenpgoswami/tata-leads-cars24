/**
 * Joins class names, skipping falsy values.
 *
 * Exports: `cn()`.
 */

/** Joins truthy class name parts with spaces. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
