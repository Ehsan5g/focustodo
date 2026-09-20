import type { Category, PrismaClient } from "@/generated/prisma/client";

import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/validation/category-schema";

/**
 * Category service (feature 004-task-categories, T007) — the scoped data
 * layer between Prisma and the server actions/pages.
 *
 * Invariants enforced here (data-model.md):
 * - EVERY read/write predicate includes `userId`; it enters only from the
 *   caller (which gets it from `requireSession()`), never from the client
 *   (FR-004, constitution I).
 * - `nameKey = name.trim().toLowerCase()` is derived ONCE here, at the write
 *   boundary (D1) — never accepted from the client, never returned.
 * - Rows NEVER cross to the client raw: every result maps to `CategoryDto` —
 *   only `id` and `name` (D9). Uniqueness is the database's job: the P2002
 *   unique violation maps to the `duplicate` reason (one friendly field
 *   error at the action layer, D1).
 * - Deletion is `deleteMany({ where: { id, userId } })` + the affected count
 *   (D10): unknown, foreign, and already-deleted ids are indistinguishable.
 * - The list orders by `nameKey` ascending — case-insensitive alphabetical
 *   (FR-005) — and selects ONLY the UI fields (constitution III).
 */

/** The client-facing category shape (contracts/server-actions.md). */
export type CategoryDto = {
  id: string;
  name: string;
};

export type CreateCategoryResult =
  { ok: true; category: CategoryDto } | { ok: false; reason: "duplicate" };

/**
 * Mutation outcome: `not_found` covers unknown, foreign, and already-deleted
 * ids (one indistinguishable path, D4); `duplicate` is the P2002 unique
 * violation against a DIFFERENT category (the old name stays untouched).
 */
export type CategoryMutationResult =
  | { ok: true; category: CategoryDto }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "duplicate" };

function toCategoryDto(row: Category): CategoryDto {
  return { id: row.id, name: row.name };
}

/** Duck-typed P2002 detection — the Prisma error code is stable across runs. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

// Test seam (same pattern as the task service): unit tests inject a mocked
// Prisma client instead of the real singleton; production code never calls
// setDbForTests.
let dbOverride: PrismaClient | null = null;

export function setDbForTests(client: PrismaClient): void {
  dbOverride = client;
}

async function getDb(): Promise<PrismaClient> {
  if (dbOverride) return dbOverride;
  const { db } = await import("@/server/db");
  return db;
}

/**
 * The signed-in user's categories, case-insensitively alphabetical (FR-005),
 * ONLY the UI-required fields — the one shape feeds the management page AND
 * the assignment picker (contracts/routes-and-surfaces.md).
 */
export async function listCategories(userId: string): Promise<CategoryDto[]> {
  const db = await getDb();
  const rows = await db.category.findMany({
    where: { userId },
    orderBy: { nameKey: "asc" },
    select: { id: true, name: true },
  });
  // D9: map explicitly so ONLY id/name cross the boundary, whatever the
  // underlying row shape.
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<CreateCategoryResult> {
  const db = await getDb();
  // D1: the key is derived here — the schema owns trimming, the service owns
  // the key, the database owns enforcement.
  const nameKey = input.name.trim().toLowerCase();
  try {
    const row = await db.category.create({
      data: { userId, name: input.name, nameKey },
    });
    return { ok: true, category: toCategoryDto(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<CategoryMutationResult> {
  const db = await getDb();
  // D4: a foreign or unknown id is indistinguishable — ownership IS the
  // lookup predicate.
  const existing = await db.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  // D8: renaming to the identical current name is a no-op success.
  if (existing.name === input.name) {
    return { ok: true, category: { id: existing.id, name: existing.name } };
  }
  const nameKey = input.name.trim().toLowerCase();
  try {
    const row = await db.category.update({
      where: { id: categoryId },
      data: { name: input.name, nameKey },
    });
    return { ok: true, category: toCategoryDto(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}

/** Ownership IS the deletion predicate (D10). False = "gone from your view". */
export async function deleteCategory(
  userId: string,
  categoryId: string,
): Promise<boolean> {
  const db = await getDb();
  const result = await db.category.deleteMany({
    where: { id: categoryId, userId },
  });
  return result.count > 0;
}
