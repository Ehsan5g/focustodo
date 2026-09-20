"use client";

import { useRouter } from "next/navigation";

import type { TaskDto } from "@/server/tasks/service";
import { isOverdue } from "@/server/tasks/rules";
import { TaskStatusToggle } from "@/features/tasks/TaskStatusToggle";

/**
 * TaskItem (feature 003-task-management, T019/T024; contracts/
 * routes-and-surfaces.md) — one list row for a `TaskDto` (D4: DTO only).
 *
 * Accessibility (FR-005, FR-012, FR-014): status and priority render as TEXT
 * badges with icons — never color alone; the OVERDUE flag is a text flag
 * derived at render time by the shared `isOverdue` from the task's calendar
 * day versus the injected `today` (D1: no clock reads inside the component).
 *
 * The complete/reopen control is the US3 optimistic toggle; the edit and
 * delete controls are wired by US4/US5 via the optional handlers.
 */

const STATUS_BADGES: Record<
  TaskDto["status"],
  { label: string; icon: string }
> = {
  TODO: { label: "To do", icon: "○" },
  IN_PROGRESS: { label: "In progress", icon: "◐" },
  COMPLETED: { label: "Completed", icon: "●" },
};

const PRIORITY_BADGES: Record<
  TaskDto["priority"],
  { label: string; icon: string }
> = {
  LOW: { label: "Low priority", icon: "↓" },
  MEDIUM: { label: "Medium priority", icon: "=" },
  HIGH: { label: "High priority", icon: "↑" },
};

export function TaskItem({
  task,
  today,
  onEdit,
  onDelete,
}: {
  task: TaskDto;
  today: Date;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const statusBadge = STATUS_BADGES[task.status];
  const priorityBadge = PRIORITY_BADGES[task.priority];
  const overdue =
    task.dueDate !== null &&
    isOverdue(new Date(`${task.dueDate}T00:00:00.000Z`), task.status, today);

  const badgeClass =
    "border-border bg-muted text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";
  const controlClass =
    "border-border hover:bg-muted focus-visible:outline-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <li
      data-testid="task-item"
      className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{task.title}</span>
          <span className={badgeClass} data-testid="status-badge">
            <span aria-hidden="true">{statusBadge.icon}</span>
            {statusBadge.label}
          </span>
          <span className={badgeClass} data-testid="priority-badge">
            <span aria-hidden="true">{priorityBadge.icon}</span>
            {priorityBadge.label}
          </span>
          {overdue && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
              data-testid="overdue-badge"
            >
              <span aria-hidden="true">⏰</span>
              Overdue
            </span>
          )}
        </div>
        {task.dueDate && (
          <span className="text-muted-foreground text-sm">
            Due {task.dueDate}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <TaskStatusToggle task={task} onUpdated={() => router.refresh()} />
        <button
          type="button"
          onClick={onEdit}
          className={controlClass}
          data-testid="edit-task"
        >
          <span aria-hidden="true">✎</span>
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={controlClass}
          data-testid="delete-task"
        >
          <span aria-hidden="true">🗑</span>
          Delete
        </button>
      </div>
    </li>
  );
}
