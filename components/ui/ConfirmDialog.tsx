/**
 * Modal confirmation dialog built on the native <dialog> element.
 *
 * Exports: `ConfirmDialog`.
 * Notes: `showModal()` provides focus trapping, Escape to cancel, and an inert
 * background. Focus starts on Cancel, so the risky action always needs a deliberate click.
 */
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation modal; controlled by `open`. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-full max-w-md rounded-md border border-gray-300 bg-white p-0 text-gray-900 shadow-lg backdrop:bg-gray-900/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <div className="text-sm text-gray-700">{children}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button ref={cancelRef} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
