import type { PrismaClient, Task, TaskStatus } from "@/generated/prisma/client";

import { validateTransition } from "@/server/tasks/rules";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "@/validation/task-schema";

/**
 * Task service (feature 003-task-management, US1–US5, T009) — the scoped
 * data layer between Prisma and the server actions/pages.
 *
 * Invariants enforced here (data-model.md):
 * - EVERY read/write predicate includes `userId`; it enters only from the
 *   caller (which gets it from `requireSession()`), never from the client
 *   (FR-004, constitution I).
 * - Rows NEVER cross to the client raw: every result maps to `TaskDto`
 *   (contracts/server-actions.md) — `dueDate` becomes an ISO calendar-day
 *   string, and `userId`/`updatedAt`/`categoryId` stay server-side.
 * - Status changes consult the one shared `validateTransition` matrix
 *   (research D2); a rejected transition performs NO write and returns
 *   `transition_rejected` so the action can surface a `status` field error.
 * - Deletion is `deleteMany({ where: { id, userId } })` + count check (D10):
 *   unknown, foreign, and already-deleted ids are indistinguishable.
 * - Overdue is NOT computed here — it is derived at render from `dueDate`
 *   via `isOverdue` (research D1); the service never stores or writes it.
 */

/** The client-facing task shape (contracts/server-actions.md). */
export type TaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  /** ISO calendar day (YYYY-MM-DD) — never a clock time. */
  dueDate: string | null;
  /** ISO timestamp — the list's newest-first ordering key. */
  createdAt: string;
};

export function toTaskDto(row: Task): TaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Mutation outcome: `ok` carries the updated DTO; `not_found` covers unknown,
 * foreign, and already-deleted ids (one indistinguishable path, D9/D10);
 * `transition_rejected` is a field-level validation failure on `status` that
 * leaves the row untouched.
 */
export type TaskMutationResult =
  | { ok: true; task: TaskDto }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "transition_rejected" };

// Test seam (D12): unit tests inject a mocked Prisma client instead of the
// real singleton; production code never calls setDbForTests.
let dbOverride: PrismaClient | null = null;

export function setDbForTests(client: PrismaClient): void {
  dbOverride = client;
}

async function getDb(): Promise<PrismaClient> {
  if (dbOverride) return dbOverride;
  const { db } = await import("@/server/db");
  return db;
}

/** The signed-in user's tasks, newest-first, ONLY the UI-required fields. */
export async function listTasks(userId: string): Promise<TaskDto[]> {
  const db = await getDb();
  const rows = await db.task.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
    },
  });
  return rows.map((row) => toTaskDto(row as Task));
}

export async function createTask(
  userId: string,
  input: CreateTaskInput,
): Promise<TaskDto> {
  const db = await getDb();
  const row = await db.task.create({ data: { ...input, userId } });
  return toTaskDto(row);
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskMutationResult> {
  const db = await getDb();
  const existing = await db.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) return { ok: false, reason: "not_found" };
  const nextStatus = input.status ?? existing.status;
  if (
    nextStatus !== existing.status &&
    !validateTransition(existing.status, nextStatus)
  ) {
    return { ok: false, reason: "transition_rejected" };
  }
  const row = await db.task.update({ where: { id: taskId }, data: input });
  return { ok: true, task: toTaskDto(row) };
}

export async function setTaskStatus(
  userId: string,
  taskId: string,
  next: TaskStatus,
): Promise<TaskMutationResult> {
  const db = await getDb();
  const existing = await db.task.findFirst({ where: { id: taskId, userId } });
  if (!existing) return { ok: false, reason: "not_found" };
  if (!validateTransition(existing.status, next)) {
    return { ok: false, reason: "transition_rejected" };
  }
  const row = await db.task.update({
    where: { id: taskId },
    data: { status: next },
  });
  return { ok: true, task: toTaskDto(row) };
}

/** Ownership IS the deletion predicate (D10). False = "gone from your view". */
export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db.task.deleteMany({ where: { id: taskId, userId } });
  return result.count > 0;
}
