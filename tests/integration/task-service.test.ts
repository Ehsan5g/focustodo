import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateTask,
} from "@/server/tasks/service";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { createTaskSchema, updateTaskSchema } from "@/validation/task-schema";

/**
 * Integration tests (F003 T008 companion, US1–US5): the task service against
 * the REAL database in a unique namespace per run (rows cascade-delete via
 * the user row). The mocked-Prisma unit test (tests/unit/task-service.test.ts)
 * pins the query shapes; this file pins the Postgres round-trips: D1 `@db.Date`
 * normalization (a stored calendar day maps back to the same YYYY-MM-DD
 * string), schema defaults, the transition matrix against real rows, cleared
 * optional fields stored as null, DTO mapping (userId never crosses out), and
 * ownership isolation (US4).
 */

const NAMESPACE = `tasksvc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let userId: string;

async function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  const input = createTaskSchema.parse({ title: "Base task", ...overrides });
  // F004: createTask is a union — unwrap for the fixture-style helper.
  const result = await createTask(userId, input);
  if (!result.ok) throw new Error("expected ok:true");
  return result.task;
}

beforeEach(async () => {
  userId = (
    await db.user.create({
      data: {
        name: "Task Service Test",
        email: `${NAMESPACE}@example.com`,
        passwordHash: await hashPassword("Password123!"),
      },
    })
  ).id;
});

afterEach(async () => {
  await db.user.delete({ where: { id: userId } });
});

describe("createTask (US1)", () => {
  it("returns the owned DTO with schema defaults applied", async () => {
    const task = await makeTask({
      description: "Milk and eggs",
      dueDate: "2026-06-01",
    });
    expect(task.title).toBe("Base task");
    expect(task.status).toBe("TODO");
    expect(task.priority).toBe("MEDIUM");
    expect(task.description).toBe("Milk and eggs");
    // D1: the stored @db.Date round-trips as a plain calendar day.
    expect(task.dueDate).toBe("2026-06-01");
    expect(task).not.toHaveProperty("userId");
  });

  it("persists any valid initial status (clarified FR-001)", async () => {
    const task = await makeTask({ status: "IN_PROGRESS" });
    const stored = await db.task.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(stored.status).toBe("IN_PROGRESS");
  });
});

describe("listTasks (US2)", () => {
  it("returns the user's DTOs newest-first", async () => {
    await makeTask({ title: "Older" });
    await new Promise((r) => setTimeout(r, 5));
    await makeTask({ title: "Newer" });
    const tasks = await listTasks(userId);
    expect(tasks.map((t) => t.title)).toEqual(["Newer", "Older"]);
  });
});

describe("updateTask (US2/US4)", () => {
  it("updates fields and can clear description and dueDate (stored as null)", async () => {
    const task = await makeTask({
      description: "Note",
      dueDate: "2026-06-01",
    });
    const updated = await updateTask(
      userId,
      task.id,
      updateTaskSchema.parse({ title: "Edited", priority: "HIGH" }),
    );
    expect(updated.ok && updated.task.title).toBe("Edited");
    expect(updated.ok && updated.task.priority).toBe("HIGH");
    const cleared = await updateTask(
      userId,
      task.id,
      updateTaskSchema.parse({ description: null, dueDate: null }),
    );
    expect(cleared.ok && cleared.task.description).toBeNull();
    expect(cleared.ok && cleared.task.dueDate).toBeNull();
  });

  it("maps an empty-string update into a cleared (null) description", async () => {
    const task = await makeTask({ description: "Will be cleared" });
    const updated = await updateTask(
      userId,
      task.id,
      updateTaskSchema.parse({ description: "" }),
    );
    expect(updated.ok && updated.task.description).toBeNull();
  });

  it("rejects a backward status change and leaves the stored row untouched", async () => {
    const task = await makeTask({ status: "IN_PROGRESS" });
    const result = await updateTask(
      userId,
      task.id,
      updateTaskSchema.parse({ status: "TODO" }),
    );
    expect(result).toEqual({ ok: false, reason: "transition_rejected" });
    const stored = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.status).toBe("IN_PROGRESS");
  });
});

describe("setTaskStatus (US3)", () => {
  it("follows the forward lifecycle TODO → IN_PROGRESS → COMPLETED", async () => {
    const task = await makeTask({});
    const started = await setTaskStatus(userId, task.id, "IN_PROGRESS");
    expect(started.ok && started.task.status).toBe("IN_PROGRESS");
    const done = await setTaskStatus(userId, task.id, "COMPLETED");
    expect(done.ok && done.task.status).toBe("COMPLETED");
    const stored = await db.task.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(stored.status).toBe("COMPLETED");
  });

  it("supports the reopen reset COMPLETED → TODO", async () => {
    const task = await makeTask({ status: "COMPLETED" });
    const reopened = await setTaskStatus(userId, task.id, "TODO");
    expect(reopened.ok && reopened.task.status).toBe("TODO");
  });
});

describe("deleteTask (US5)", () => {
  it("deletes the owned task; a second attempt is indistinguishable", async () => {
    const task = await makeTask({});
    await expect(deleteTask(userId, task.id)).resolves.toBe(true);
    await expect(deleteTask(userId, task.id)).resolves.toBe(false);
    await expect(
      db.task.findUnique({ where: { id: task.id } }),
    ).resolves.toBeNull();
  });
});

describe("ownership isolation (US4)", () => {
  it("treats another user's task id like an unknown id", async () => {
    const task = await makeTask({});
    await db.user.create({
      data: {
        name: "Other User",
        email: `${NAMESPACE}_other@example.com`,
        passwordHash: await hashPassword("Password123!"),
        tasks: { create: { title: "Not mine" } },
      },
    });
    const other = await db.user.findUniqueOrThrow({
      where: { email: `${NAMESPACE}_other@example.com` },
      include: { tasks: true },
    });
    const otherTaskId = other.tasks[0]!.id;
    expect(
      await updateTask(
        userId,
        otherTaskId,
        updateTaskSchema.parse({ title: "hijack" }),
      ),
    ).toEqual({ ok: false, reason: "not_found" });
    expect(await setTaskStatus(userId, otherTaskId, "COMPLETED")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await deleteTask(userId, otherTaskId)).toBe(false);
    expect(
      await updateTask(
        userId,
        task.id,
        updateTaskSchema.parse({ title: "still mine" }),
      ),
    ).not.toEqual({ ok: false, reason: "not_found" });
    await db.user.delete({
      where: { email: `${NAMESPACE}_other@example.com` },
    });
  });
});
