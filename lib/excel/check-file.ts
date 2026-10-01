/**
 * Pre-parse checks for the selected or dropped file(s).
 *
 * Exports: `checkUploadFile()`.
 * Notes: Kept separate from `parse.ts` so the dropzone can use it without loading
 * SheetJS.
 */
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from "@/config/excel-layout";

/**
 * Checks that exactly one acceptable Excel file was given.
 * @returns an error message, or null when the file is acceptable.
 */
export function checkUploadFile(files: ReadonlyArray<{ name: string; size: number }>): string | null {
  if (files.length === 0) {
    return "No file selected.";
  }
  if (files.length > 1) {
    return "Upload one file at a time.";
  }
  const file = files[0];
  if (!file) {
    return "No file selected.";
  }
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return `"${file.name}" is not an Excel file. Upload a .xlsx or .xls file.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}
