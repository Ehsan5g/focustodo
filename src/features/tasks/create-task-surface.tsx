"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { TaskForm } from "@/features/tasks/TaskForm";
import {
  createTaskAction,
  type TaskActionResult,
} from "@/server/actions/task-actions";

/**
 * Create-task surface context (feature 003-task-management, T014/T015/T019;
 * contracts/routes-and-surfaces.md) — ONE adaptive create surface shared by
 * the page header's "New task" control and the empty state's
 * create-your-first-task action (FR-013): a bottom Sheet below `sm` and a
 * centered Dialog at `sm` and above (research D7). Radix Dialog is not a
 * dependency, so the overlay is native elements: Escape closes, backdrop
 * click closes, focus moves into the form (FR-014).
 *
 * On success the action revalidates the list; the surface closes (SC-001).
 */

type CreateTaskSurface = { openCreateSurface: () => void };

const CreateTaskSurfaceContext = createContext<CreateTaskSurface | null>(null);

export function useCreateTaskSurface(): CreateTaskSurface {
  const context = useContext(CreateTaskSurfaceContext);
  if (!context) {
    throw new Error(
      "useCreateTaskSurface must be used inside CreateTaskSurfaceProvider",
    );
  }
  return context;
}

export function CreateTaskSurfaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openCreateSurface = useCallback(() => setOpen(true), []);

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

  const handleAction = useCallback(
    async (
      prev: TaskActionResult | null,
      formData: FormData,
    ): Promise<TaskActionResult> => {
      const result = await createTaskAction(prev, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    [],
  );

  return (
    <CreateTaskSurfaceContext.Provider value={{ openCreateSurface }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
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
      )}
    </CreateTaskSurfaceContext.Provider>
  );
}

/** The page header trigger (T015) — the same adaptive surface on open. */
export function NewTaskButton() {
  const { openCreateSurface } = useCreateTaskSurface();
  return (
    <Button onClick={openCreateSurface} data-testid="new-task-button">
      New task
    </Button>
  );
}
