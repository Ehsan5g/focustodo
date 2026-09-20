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

/** The client-facing task shape (contracts/server-actions.md). F004 T018
 * (D5): the read joins the owner's category so the list can render the
 * category NAME as text — the raw categoryId travels too (edit prefill). */
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
  /** F004: the owner's category link, when the row carries the join. */
  categoryId: string | null;
  categoryName: string | null;
};

/** A task row that may carry the F004 category join (D5) — the mocked Prisma
 * row in tests and the select-narrowed list row both fit this shape. */
type TaskRowWithCategory = Task & {
  category?: { id: string; name: string } | null;
};

export function toTaskDto(row: TaskRowWithCategory): TaskDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    createdAt: row.createdAt.toISOString(),
    categoryId: row.category?.id ?? null,
    categoryName: row.category?.name ?? null,
  };
}

/**
 * Mutation outcome: `not_found` covers unknown, foreign, and already-deleted
 * ids (one indistinguishable path, D9/D10); `transition_rejected` is a
 * field-level validation failure on `status` that leaves the row untouched;
 * `category_not_found` (F004) is the owner-scoped category resolution failure
 * — it also performs NO write.
 */
export type TaskMutationResult =
  | { ok: true; task: TaskDto }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "transition_rejected" }
  | { ok: false; reason: "category_not_found" };

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
      // F004 T018 (D5): the category join rides the ONE list read — the
      // badge renders the name; the id prefills the edit surface.
      category: { select: { id: true, name: true } },
    },
  });
  return rows.map((row) => toTaskDto(row as TaskRowWithCategory));
}

/**
 * F004 T018: creation's outcome is a union — a non-null categoryId that is
 * foreign or unknown resolves to `category_not_found` with NO write.
 */
export type CreateTaskResult =
  { ok: true; task: TaskDto } | { ok: false; reason: "category_not_found" };

export async function createTask(
  userId: string,
  input: CreateTaskInput,
): Promise<CreateTaskResult> {
  const db = await getDb();
  // FR-005: resolve the category AGAINST THE OWNER before any write. A null
  // categoryId skips the lookup entirely (no category = no join to check).
  if (input.categoryId !== null) {
    const category = await db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!category) return { ok: false, reason: "category_not_found" };
  }
  const row = await db.task.create({ data: { ...input, userId } });
  return { ok: true, task: toTaskDto(row) };
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskMutationResult> {
  const db = await getDb();
  // Narrow scoped pre-read: the transition matrix needs `status`; F004 keeps
  // the pre-read category-aware (`categoryId` rides along) while staying
  // select-only — never the whole row.
  const existing = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { categoryId: true, status: true },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  const nextStatus = input.status ?? existing.status;
  if (
    nextStatus !== existing.status &&
    !validateTransition(existing.status, nextStatus)
  ) {
    return { ok: false, reason: "transition_rejected" };
  }
  // FR-005: same owner-scoped resolution as create. `undefined` means "no
  // change" (partial semantics); a non-null id that is foreign or unknown
  // performs NO write; an explicit null clears the link (FR-006).
  if (input.categoryId !== undefined && input.categoryId !== null) {
    const category = await db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!category) return { ok: false, reason: "category_not_found" };
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
