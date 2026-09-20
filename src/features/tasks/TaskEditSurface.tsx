"use client";

import { useEffect, useRef, useState } from "react";

import { TaskForm } from "@/features/tasks/TaskForm";
import {
  updateTaskAction,
  type TaskActionResult,
} from "@/server/actions/task-actions";
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
  open,
  onClose,
}: {
  task: TaskDto;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Snapshot the DTO on open so re-renders of the parent list (e.g. after a
  // toggle's refresh) never mutate the in-flight form's prefilled values.
  const [snapshot] = useState(task);
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
          initial={{
            title: snapshot.title,
            description: snapshot.description ?? "",
            dueDate: snapshot.dueDate ?? "",
            priority: snapshot.priority,
            status: snapshot.status,
          }}
          submitLabel="Save changes"
          cancelLabel="Cancel"
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
