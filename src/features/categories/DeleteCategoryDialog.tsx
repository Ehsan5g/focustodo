"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  deleteCategoryAction,
  type CategoryDeleteResult,
} from "@/server/actions/category-actions";

/**
 * DeleteCategoryDialog (feature 004-task-categories, T031, US4; contracts/
 * routes-and-surfaces.md) — explicit confirmation before a PERMANENT delete,
 * F003's copy-in AlertDialog convention (D7) implemented with native
 * elements like the adaptive surfaces: Escape closes, backdrop click closes,
 * focus moves to Cancel (FR-014). The copy states the reassignment outcome
 * up front (FR-010, US4.1): assigned tasks become uncategorized, they are
 * NOT deleted. A failure keeps the dialog open with a friendly message
 * (stale delete, S13/D12); rapid repeat clicks submit once (D8).
 */
export function DeleteCategoryDialog({
  categoryId,
  categoryName,
  open,
  onDeleted,
  onClose,
}: {
  categoryId: string;
  categoryName: string;
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
        "button[data-testid='delete-category-cancel']",
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
      const result: CategoryDeleteResult =
        await deleteCategoryAction(categoryId);
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
        aria-label="Delete category"
        data-testid="delete-category-surface"
        className="bg-card relative w-full max-w-md rounded-xl border p-6 shadow-lg"
      >
        <h2 className="mb-2 text-lg font-semibold">Delete category?</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          “{categoryName}” will be removed. Tasks assigned to it are not deleted
          — they become uncategorized.
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
            data-testid="delete-category-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {pending ? "Deleting…" : "Delete category"}
          </Button>
        </div>
      </div>
    </div>
  );
}
