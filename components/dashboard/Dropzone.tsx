/**
 * Drag-and-drop or click-to-browse zone for a single Excel file.
 *
 * Exports: `Dropzone`.
 * Notes: The zone itself is the button: Tab to focus it, Enter or Space opens the file
 * picker. Multiple files or wrong types are rejected by the parent via `checkUploadFile`.
 */
"use client";

import { FileSpreadsheet } from "lucide-react";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/cn";
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from "@/config/excel-layout";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

/** File drop target that also opens a file picker. */
export function Dropzone({ onFiles, disabled = false }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
      setDragging(true);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) {
      onFiles(Array.from(event.dataTransfer.files));
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label="Upload Excel file: drop a file here or press Enter to browse"
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-12 text-center transition-colors",
        dragging && "border-blue-700 bg-blue-50",
        !dragging && "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <FileSpreadsheet aria-hidden className="size-6 text-gray-500" />
      <p className="text-sm font-medium text-gray-900">Drop an Excel file here, or click to browse</p>
      <p className="text-xs text-gray-600">
        One {ACCEPTED_EXTENSIONS.join(" or ")} file, up to {MAX_FILE_BYTES / (1024 * 1024)} MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) {
            onFiles(files);
          }
        }}
      />
    </div>
  );
}
