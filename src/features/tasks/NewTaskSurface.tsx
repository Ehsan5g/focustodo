"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TaskForm } from "@/features/tasks/TaskForm";
import {
  createTaskAction,
  type TaskActionResult,
} from "@/server/actions/task-actions";

/**
 * NewTaskSurface (feature 003-task-management, T014/T015; contracts/
 * routes-and-surfaces.md) — the adaptive create-task surface: a bottom
 * Sheet below `sm` and a centered Dialog at `sm` and above (research D7).
 * Radix Dialog is not a dependency (D7 allows only the existing stack), so
 * the overlay is implemented with native elements: focus moves to the form's
 * first field on open, Escape closes, and the backdrop click closes —
 * keyboard-operable with visible focus (FR-014).
 *
 * On success the server action revalidates the list; the surface closes and
 * the task appears (SC-001, quickstart S1).
 */

export function NewTaskSurface() {
  const [open, setOpen] = useState(false);

  // Close the surface when the action succeeds (the task then appears in the
  // revalidated list). The wrapper around createTaskAction reports the result.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} data-testid="new-task-button">
        New task
      </Button>
    );
  }

  const handleAction = async (
    _prev: TaskActionResult | null,
    formData: FormData,
  ): Promise<TaskActionResult> => {
    const result = await createTaskAction(_prev, formData);
    if (result.status === "success") setOpen(false);
    return result;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      {/* Sheet (<sm, bottom) / Dialog (≥sm, centered) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New task"
        data-testid="new-task-surface"
        className="bg-card relative w-full max-w-lg rounded-t-xl border p-6 shadow-lg sm:rounded-xl"
      >
        <h2 className="mb-4 text-lg font-semibold">New task</h2>
        <TaskForm action={handleAction} />
      </div>
    </div>
  );
}
