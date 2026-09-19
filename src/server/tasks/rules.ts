import type { TaskStatus } from "@/generated/prisma/client";

/**
 * Pure task rules (feature 003-task-management, research D2/D12) — no I/O,
 * no Date.now() inside the functions; dependencies are injected so the rules
 * stay deterministic and unit-testable (constitution II).
 */

/**
 * Status lifecycle (data-model.md): forward-only transitions plus the reopen
 * reset. Allowed: TODO→IN_PROGRESS, TODO→COMPLETED, IN_PROGRESS→COMPLETED,
 * COMPLETED→TODO (reopen), and every same-status no-op. Rejected:
 * IN_PROGRESS→TODO, COMPLETED→IN_PROGRESS.
 */
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["TODO", "IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["COMPLETED", "TODO"],
};

export function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Overdue = calendar-day comparison only (research D1): the due day is
 * strictly before the current calendar day AND the task is still open.
 * Completed tasks are never overdue. `today` is injected (D12) — callers
 * pass `new Date()`; the function itself never reads the clock.
 */
export function isOverdue(
  dueDate: Date | null,
  status: TaskStatus,
  today: Date,
): boolean {
  if (!dueDate || status === "COMPLETED") return false;
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const dueUtc = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate(),
  );
  return dueUtc < todayUtc;
}
