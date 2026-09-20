"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  deleteTaskAction,
  type DeleteTaskResult,
} from "@/server/actions/task-actions";

/**
 * DeleteConfirmDialog (feature 003-task-management, T034, US5; contracts/
 * routes-and-surfaces.md) — explicit confirmation before a PERMANENT delete
 * (FR-010), the shadcn/ui AlertDialog convention (D7) implemented with native
 * elements like the adaptive surfaces: Escape closes, backdrop click closes,
 * focus moves into the dialog (FR-014). A failure keeps the dialog open with
 * a friendly message (stale delete, FR-011); rapid repeat clicks submit once
 * (D8).
 */
export function DeleteConfirmDialog({
  taskId,
  taskTitle,
  open,
  onDeleted,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  open: boolean;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const focusedRef = useRef(false);
  // Reset the stale-error state on open using the documented
  // "adjust state during render" pattern (react-hooks lint rule: no
  // setState inside effects). Each open starts with a clean slate.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setError(null);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    focusedRef.current = false;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && !focusedRef.current && dialogRef.current) {
      const cancel = dialogRef.current.querySelector<HTMLButtonElement>(
        "button[data-testid='delete-cancel']",
      );
      cancel?.focus();
      focusedRef.current = true;
    }
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    if (inFlightRef.current) return; // D8: one submission at a time
    inFlightRef.current = true;
    setPending(true);
    setError(null);
    try {
      const result: DeleteTaskResult = await deleteTaskAction(taskId);
      if (result.status === "success") {
        onDeleted();
        onClose();
      } else {
        setError(result.message);
      }
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => onClose()}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete task"
        data-testid="delete-confirm-dialog"
        className="bg-card relative w-full max-w-md rounded-xl border p-6 shadow-lg"
      >
        <h2 className="mb-2 text-lg font-semibold">Delete task?</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          “{taskTitle}” will be permanently deleted. This cannot be undone.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={pending}
            data-testid="delete-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
    </div>
  );
}
