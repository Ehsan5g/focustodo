"use client";

import { useEffect, useRef, useState } from "react";

import { TaskForm } from "@/features/tasks/TaskForm";
import {
  updateTaskAction,
  type TaskActionResult,
} from "@/server/actions/task-actions";
import type { CategoryDto } from "@/server/categories/service";
import type { TaskDto } from "@/server/tasks/service";

/**
 * TaskEditSurface (feature 003-task-management, T029, US4; contracts/
 * routes-and-surfaces.md) — the SAME adaptive surface as create (Dialog on
 * desktop ≥sm, bottom Sheet on mobile <sm, research D7) reused in edit mode:
 * prefilled from the TaskDto, "Cancel" closes with zero mutations, success
 * closes the surface (the action revalidates the list). Native elements, no
 * Radix dependency: Escape closes, backdrop click closes, focus moves into
 * the form (FR-014). `onClose` runs on every close path; the task's values
 * live only in this snapshot, so a cancelled edit cannot touch the server.
 */
export function TaskEditSurface({
  task,
  categories,
  open,
  onClose,
}: {
  task: TaskDto;
  /** F004: the owner's categories for the assignment picker. */
  categories?: CategoryDto[];
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Snapshot the DTO so re-renders of the parent list (e.g. after a toggle's
  // refresh) never mutate the IN-FLIGHT form's prefilled values. The snapshot
  // RESYNCS while the surface is closed (render-phase adjust — the same
  // documented pattern as TaskForm's status check): reopening must pre-fill
  // the CURRENT server state, including a category link assigned by a
  // previous edit (F004 T017, S5's reopen prefill). While open it is frozen.
  const [snapshot, setSnapshot] = useState(task);
  if (!open && snapshot !== task) {
    setSnapshot(task);
  }
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    focusedRef.current = false;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && !focusedRef.current && dialogRef.current) {
      const first = dialogRef.current.querySelector<HTMLElement>(
        "input, select, textarea, button",
      );
      first?.focus();
      focusedRef.current = true;
    }
  }, [open]);

  if (!open) return null;

  const handleAction = async (
    prev: TaskActionResult | null,
    formData: FormData,
  ): Promise<TaskActionResult> => {
    const result = await updateTaskAction(prev, formData);
    if (result.status === "success") onClose();
    return result;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
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
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        data-testid="edit-task-surface"
        className="bg-card relative w-full max-w-lg rounded-t-xl border p-6 shadow-lg sm:rounded-xl"
      >
        <h2 className="mb-4 text-lg font-semibold">Edit task</h2>
        <TaskForm
          action={handleAction}
          taskId={snapshot.id}
          categories={categories}
          initial={{
            title: snapshot.title,
            description: snapshot.description ?? "",
            dueDate: snapshot.dueDate ?? "",
            priority: snapshot.priority,
            status: snapshot.status,
            categoryId: snapshot.categoryId ?? "",
          }}
          submitLabel="Save changes"
          cancelLabel="Cancel"
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
