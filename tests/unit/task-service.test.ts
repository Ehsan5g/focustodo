import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateTask,
} from "@/server/tasks/service";
import { createTaskSchema, updateTaskSchema } from "@/validation/task-schema";

/**
 * Unit tests (F003 T008, D2/D9/D10/D12): task service against a MOCKED
 * Prisma client (same seam as session.test.ts — tests inject the mock via
 * setDbForTests; production code never does).
 *
 * Verified here: every read/write predicate includes `userId`; listTasks
 * selects ONLY the UI fields and orders createdAt desc; rows map to TaskDto
 * (dueDate as an ISO calendar-day string; `userId` never crosses out); a
 * backward status change is rejected without any write; unknown, foreign,
 * and already-deleted ids are indistinguishable; deleteTask uses deleteMany
 * plus an affected-count check (ownership IS the deletion predicate, D10).
 */

const dueDate = new Date("2026-06-01T00:00:00.000Z");

type Row = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: Date | null;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const row: Row = {
  id: "task-1",
  userId: "user-1",
  title: "Write specs",
  description: null,
  status: "TODO",
  priority: "MEDIUM",
  dueDate,
  categoryId: null,
  createdAt: new Date("2026-05-01T10:00:00.000Z"),
  updatedAt: new Date("2026-05-01T10:00:00.000Z"),
};

function makeTaskRow(overrides: Partial<Row> = {}): Row {
  return { ...row, ...overrides };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    task: {
      create: vi.fn().mockResolvedValue(makeTaskRow()),
      findMany: vi.fn().mockResolvedValue([makeTaskRow()]),
      findFirst: vi.fn().mockResolvedValue(makeTaskRow()),
      update: vi.fn().mockResolvedValue(makeTaskRow()),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...overrides,
    },
  };
}

vi.mock("@/server/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/db")>();
  return {
    ...mod,
    get db() {
      throw new Error("tests must inject a mock db via setDbForTests");
    },
  };
});

import { setDbForTests } from "@/server/tasks/service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTasks (read contract — only UI fields, newest first)", () => {
  it("queries scoped, ordered, and select-only-UI-fields; maps to TaskDto", async () => {
    const db = makeDb({
      findMany: vi
        .fn()
        .mockResolvedValue([makeTaskRow(), makeTaskRow({ id: "task-2" })]),
    });
    setDbForTests(db as never);
    const dtos = await listTasks("user-1");
    const arg = db.task.findMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ userId: "user-1" });
    expect(arg.orderBy).toEqual({ createdAt: "desc" });
    expect(Object.keys(arg.select).sort()).toEqual(
      [
        "createdAt",
        "description",
        "dueDate",
        "id",
        "priority",
        "status",
        "title",
      ].sort(),
    );
    expect(dtos).toHaveLength(2);
    expect(dtos[0]).toEqual({
      id: "task-1",
      title: "Write specs",
      description: null,
      status: "TODO",
      priority: "MEDIUM",
      dueDate: "2026-06-01",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
    expect(dtos[0]).not.toHaveProperty("userId");
  });

  it("maps a null dueDate to null", async () => {
    const db = makeDb({
      findMany: vi.fn().mockResolvedValue([makeTaskRow({ dueDate: null })]),
    });
    setDbForTests(db as never);
    const [dto] = await listTasks("user-1");
    expect(dto?.dueDate).toBeNull();
  });
});

describe("createTask (US1)", () => {
  it("writes with the owner id and returns the mapped DTO", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    const input = createTaskSchema.parse({
      title: "New task",
      dueDate: "2026-06-01",
    });
    const dto = await createTask("user-1", input);
    const arg = db.task.create.mock.calls[0]?.[0];
    expect(arg.data).toEqual({
      title: "New task",
      description: null,
      status: "TODO",
      priority: "MEDIUM",
      dueDate,
      userId: "user-1",
    });
    expect(dto.dueDate).toBe("2026-06-01");
    expect(dto).not.toHaveProperty("userId");
  });
});

describe("updateTask (US2/US4 — loads the scoped row, consults the matrix)", () => {
  it("loads with { id, userId }, validates, then updates and maps the DTO", async () => {
    const db = makeDb({
      update: vi.fn().mockResolvedValue(makeTaskRow({ title: "Edited" })),
    });
    setDbForTests(db as never);
    const result = await updateTask("user-1", "task-1", {
      title: "Edited",
    });
    expect(db.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task-1", userId: "user-1" },
    });
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { title: "Edited" },
    });
    expect(result).toEqual({
      ok: true,
      task: expect.objectContaining({ id: "task-1", title: "Edited" }),
    });
    expect(result.ok && result.task).not.toHaveProperty("userId");
  });

  it("rejects a backward transition with no write at all", async () => {
    const db = makeDb({
      findFirst: vi
        .fn()
        .mockResolvedValue(makeTaskRow({ status: "COMPLETED" })),
    });
    setDbForTests(db as never);
    const input = updateTaskSchema.parse({ status: "IN_PROGRESS" });
    const result = await updateTask("user-1", "task-1", input);
    expect(result).toEqual({ ok: false, reason: "transition_rejected" });
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("treats an unknown or foreign id as not_found (indistinguishable, D9)", async () => {
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue(null) });
    setDbForTests(db as never);
    const result = await updateTask("user-1", "nope", { title: "x" });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(db.task.update).not.toHaveBeenCalled();
  });
});

describe("setTaskStatus (US3 — single-interaction path)", () => {
  it("allows forward and reopen moves", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    const started = await setTaskStatus("user-1", "task-1", "IN_PROGRESS");
    expect(started).toEqual({ ok: true, task: expect.anything() });
    const reopened = await setTaskStatus("user-1", "task-1", "COMPLETED");
    expect(reopened.ok).toBe(true);
  });

  it("same-status submissions are no-op successes", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    const result = await setTaskStatus("user-1", "task-1", "TODO");
    expect(result).toEqual({ ok: true, task: expect.anything() });
  });

  it("rejects backward moves with a transition_rejected result and no write", async () => {
    const db = makeDb({
      findFirst: vi
        .fn()
        .mockResolvedValue(makeTaskRow({ status: "IN_PROGRESS" })),
    });
    setDbForTests(db as never);
    const result = await setTaskStatus("user-1", "task-1", "TODO");
    expect(result).toEqual({ ok: false, reason: "transition_rejected" });
    expect(db.task.update).not.toHaveBeenCalled();
  });
});

describe("deleteTask (US5 — D10: ownership IS the deletion predicate)", () => {
  it("deleteMany with { id, userId }; count 1 → true", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    await expect(deleteTask("user-1", "task-1")).resolves.toBe(true);
    expect(db.task.deleteMany).toHaveBeenCalledWith({
      where: { id: "task-1", userId: "user-1" },
    });
  });

  it("count 0 → false — unknown, foreign, and already-deleted are indistinguishable", async () => {
    const db = makeDb({ deleteMany: vi.fn().mockResolvedValue({ count: 0 }) });
    setDbForTests(db as never);
    await expect(deleteTask("user-1", "gone")).resolves.toBe(false);
  });
});
