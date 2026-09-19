"use client";

import type { TaskDto } from "@/server/tasks/service";

import { TaskItem } from "@/features/tasks/TaskItem";

/**
 * TaskList (feature 003-task-management, T019; contracts/
 * routes-and-surfaces.md) — the newest-first list of `TaskDto`s (D4: the
 * page's ONE scoped query feeds it directly; ordering is the server's
 * `createdAt desc`). The empty state (FR-013) offers a clear
 * create-your-first-task action that opens the same adaptive create surface
 * as the page header's "New task" control.
 */
export function TaskList({
  tasks,
  today,
  onCreateClick,
  onToggleStatus,
  onEdit,
  onDelete,
}: {
  tasks: TaskDto[];
  today: Date;
  onCreateClick?: () => void;
  onToggleStatus?: (task: TaskDto) => void;
  onEdit?: (task: TaskDto) => void;
  onDelete?: (task: TaskDto) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div
        data-testid="task-empty-state"
        className="border-border rounded-xl border border-dashed p-8 text-center"
      >
        <p className="text-muted-foreground mb-4">
          No tasks yet. Stay focused by capturing what matters.
        </p>
        <button
          type="button"
          onClick={onCreateClick}
          className="bg-primary text-primary-foreground focus-visible:outline-ring inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          data-testid="empty-state-create"
        >
          <span aria-hidden="true">＋</span>
          Create your first task
        </button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          today={today}
          onToggleStatus={
            onToggleStatus ? () => onToggleStatus(task) : undefined
          }
          onEdit={onEdit ? () => onEdit(task) : undefined}
          onDelete={onDelete ? () => onDelete(task) : undefined}
        />
      ))}
    </ul>
  );
}
