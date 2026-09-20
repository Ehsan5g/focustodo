import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/server/categories/service";
import { createCategorySchema } from "@/validation/category-schema";

/**
 * Unit tests (F004 T005, D1/D4/D9/D10): category service against a MOCKED
 * Prisma client (the same setDbForTests seam as the task service — tests
 * inject the mock; production code never does).
 *
 * Verified here: every read/write predicate is scoped `where { userId }`;
 * the list selects ONLY the UI fields ordered by `nameKey` ascending
 * (case-insensitive alphabetical, FR-005); create derives `nameKey` at the
 * write boundary and maps the P2002 unique violation to the duplicate
 * reason; update treats an identical name (after trim) as a no-op success
 * (D8); delete uses `deleteMany` + the affected count (ownership IS the
 * deletion predicate, D4/D10); mutations map to `CategoryDto` — no raw
 * Prisma rows cross the boundary and no `userId`/`nameKey` in the DTO (D9).
 */

type Row = {
  id: string;
  userId: string;
  name: string;
  nameKey: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "cat-1",
    userId: "user-1",
    name: "Work",
    nameKey: "work",
    createdAt: new Date("2026-09-20T00:00:00.000Z"),
    updatedAt: new Date("2026-09-20T00:00:00.000Z"),
    ...overrides,
  };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    category: {
      findMany: vi.fn().mockResolvedValue([makeRow()]),
      create: vi.fn().mockResolvedValue(makeRow()),
      findFirst: vi.fn().mockResolvedValue(makeRow()),
      update: vi
        .fn()
        .mockResolvedValue(
          makeRow({ name: "Deep Work", nameKey: "deep work" }),
        ),
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

import { setDbForTests } from "@/server/categories/service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCategories (read contract — only UI fields, nameKey order)", () => {
  it("queries scoped, nameKey-ordered, select-only-UI-fields; maps to DTOs", async () => {
    const db = makeDb({
      findMany: vi
        .fn()
        .mockResolvedValue([
          makeRow({ id: "cat-a", name: "apple", nameKey: "apple" }),
          makeRow({ id: "cat-b", name: "Banana", nameKey: "banana" }),
        ]),
    });
    setDbForTests(db as never);
    const dtos = await listCategories("user-1");
    const arg = db.category.findMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ userId: "user-1" });
    expect(arg.orderBy).toEqual({ nameKey: "asc" });
    expect(Object.keys(arg.select).sort()).toEqual(["id", "name"].sort());
    expect(dtos).toEqual([
      { id: "cat-a", name: "apple" },
      { id: "cat-b", name: "Banana" },
    ]);
  });
});

describe("createCategory (US1 — nameKey derived at the write boundary)", () => {
  it("inserts scoped with the derived nameKey and maps the DTO", async () => {
    const db = makeDb({
      create: vi
        .fn()
        .mockResolvedValue(
          makeRow({ name: "Deep Work", nameKey: "deep work" }),
        ),
    });
    setDbForTests(db as never);
    const input = createCategorySchema.parse({ name: "  Deep Work  " });
    const result = await createCategory("user-1", input);
    expect(db.category.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "Deep Work", nameKey: "deep work" },
    });
    expect(result).toEqual({
      ok: true,
      category: { id: "cat-1", name: "Deep Work" },
    });
    const dto = result.ok ? result.category : null;
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("nameKey");
  });

  it("maps the P2002 unique violation to the duplicate reason", async () => {
    const db = makeDb({ create: vi.fn().mockRejectedValue({ code: "P2002" }) });
    setDbForTests(db as never);
    const result = await createCategory("user-1", { name: "Work" });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("rethrows non-unique failures (the action maps them to the generic failure)", async () => {
    const db = makeDb({ create: vi.fn().mockRejectedValue(new Error("boom")) });
    setDbForTests(db as never);
    await expect(createCategory("user-1", { name: "Work" })).rejects.toThrow(
      "boom",
    );
  });
});

describe("updateCategory (US3 — D8 no-op + D4 indistinguishable misses)", () => {
  it("loads scoped, then writes name + nameKey once on a real rename", async () => {
    const db = makeDb({
      findFirst: vi.fn().mockResolvedValue(makeRow()),
      update: vi
        .fn()
        .mockResolvedValue(
          makeRow({ name: "Deep Work", nameKey: "deep work" }),
        ),
    });
    setDbForTests(db as never);
    const result = await updateCategory("user-1", "cat-1", {
      name: "Deep Work",
    });
    expect(db.category.findFirst).toHaveBeenCalledWith({
      where: { id: "cat-1", userId: "user-1" },
    });
    expect(db.category.update).toHaveBeenCalledWith({
      where: { id: "cat-1" },
      data: { name: "Deep Work", nameKey: "deep work" },
    });
    expect(result).toEqual({
      ok: true,
      category: { id: "cat-1", name: "Deep Work" },
    });
  });

  it("treats a rename to the identical current name as a no-op success (D8)", async () => {
    const db = makeDb({
      findFirst: vi
        .fn()
        .mockResolvedValue(makeRow({ name: "Work", nameKey: "work" })),
    });
    setDbForTests(db as never);
    const result = await updateCategory("user-1", "cat-1", { name: "Work" });
    expect(result).toEqual({
      ok: true,
      category: { id: "cat-1", name: "Work" },
    });
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("maps the P2002 rename collision to the duplicate reason (old name untouched)", async () => {
    const db = makeDb({
      findFirst: vi.fn().mockResolvedValue(makeRow()),
      update: vi.fn().mockRejectedValue({ code: "P2002" }),
    });
    setDbForTests(db as never);
    const result = await updateCategory("user-1", "cat-1", { name: "Other" });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("treats an unknown or foreign id as not_found (indistinguishable, D4)", async () => {
    const db = makeDb({ findFirst: vi.fn().mockResolvedValue(null) });
    setDbForTests(db as never);
    const result = await updateCategory("user-1", "gone", { name: "x" });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(db.category.update).not.toHaveBeenCalled();
  });
});

describe("deleteCategory (US4 — D10: ownership IS the deletion predicate)", () => {
  it("deleteMany with { id, userId }; count 1 → true", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    await expect(deleteCategory("user-1", "cat-1")).resolves.toBe(true);
    expect(db.category.deleteMany).toHaveBeenCalledWith({
      where: { id: "cat-1", userId: "user-1" },
    });
  });

  it("count 0 → false — unknown, foreign, and already-deleted are indistinguishable", async () => {
    const db = makeDb({ deleteMany: vi.fn().mockResolvedValue({ count: 0 }) });
    setDbForTests(db as never);
    await expect(deleteCategory("user-1", "gone")).resolves.toBe(false);
  });
});
