import { z } from "zod";

/**
 * Shared category schemas (feature 004-task-categories, T006; D1/D9) — the
 * single Zod source of truth for category create/update and id parsing,
 * shared between client and server (constitution II). The server re-validates
 * every action input even though the client also validates.
 *
 * Rules (data-model.md, spec assumptions):
 * - name: required, 1–60 characters after trimming; whitespace-only is
 *   rejected as empty; surrounding spaces are trimmed before storage while
 *   the original letter case is preserved (the name is the only displayed
 *   field)
 * - nameKey: NOT part of any client-facing schema — the lowercased trimmed
 *   name is derived server-side, once, at the service write boundary (D1)
 */

export const CATEGORY_NAME_MAX_LENGTH = 60;

const categoryNameSchema = z
  .string({ error: "Category name is required" })
  .trim()
  .min(1, "Category name is required")
  .max(
    CATEGORY_NAME_MAX_LENGTH,
    `Category name must be at most ${CATEGORY_NAME_MAX_LENGTH} characters`,
  );

export const createCategorySchema = z.object({ name: categoryNameSchema });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/** Rename submits the full form — identical field rules (FR-009). */
export const updateCategorySchema = z.object({ name: categoryNameSchema });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryIdSchema = z
  .string({ error: "Category id is required" })
  .trim()
  .min(1, "Category id is required");
