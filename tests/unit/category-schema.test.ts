import { describe, expect, it } from "vitest";

import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "@/validation/category-schema";

/**
 * Unit tests (F004 T004, D1/D9): the shared category schemas — the single
 * Zod source of truth (constitution II) and the validation rules from
 * data-model.md: name required, 1–60 characters after trimming;
 * whitespace-only rejected as empty; surrounding spaces trimmed before
 * storage while the original case is preserved. `nameKey` is derived
 * server-side at the service boundary — never accepted from the client and
 * absent from every client-facing shape (D1).
 */

describe("createCategorySchema — name rules (FR-001/FR-002)", () => {
  it("accepts a 1-character name", () => {
    const result = createCategorySchema.safeParse({ name: "a" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("a");
  });

  it("accepts exactly 60 characters (S4 boundary)", () => {
    const result = createCategorySchema.safeParse({ name: "x".repeat(60) });
    expect(result.success).toBe(true);
  });

  it("rejects 61 characters with a clear message (S4 boundary)", () => {
    const result = createCategorySchema.safeParse({ name: "x".repeat(61) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("60");
    }
  });

  it("rejects whitespace-only names as empty (S3)", () => {
    const result = createCategorySchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("required");
    }
  });

  it("rejects a missing name", () => {
    expect(createCategorySchema.safeParse({}).success).toBe(false);
  });

  it("trims surrounding spaces but preserves the original case", () => {
    const result = createCategorySchema.parse({ name: "  Deep Work  " });
    expect(result.name).toBe("Deep Work");
  });
});

describe("updateCategorySchema — identical field rules (FR-009)", () => {
  it("accepts the same valid names", () => {
    expect(updateCategorySchema.safeParse({ name: "Work" }).success).toBe(true);
  });

  it("rejects whitespace-only and over-length names identically", () => {
    expect(updateCategorySchema.safeParse({ name: "  " }).success).toBe(false);
    expect(
      updateCategorySchema.safeParse({ name: "x".repeat(61) }).success,
    ).toBe(false);
  });
});

describe("categoryIdSchema — action params (D4)", () => {
  it("accepts a non-empty string id", () => {
    expect(categoryIdSchema.safeParse("cat-1").success).toBe(true);
  });

  it("rejects empty and whitespace-only ids", () => {
    expect(categoryIdSchema.safeParse("").success).toBe(false);
    expect(categoryIdSchema.safeParse("   ").success).toBe(false);
  });
});

describe("client-facing shape hygiene (D1/D9)", () => {
  it("never accepts a client-supplied nameKey — it is server-derived (D1)", () => {
    const result = createCategorySchema.parse({
      name: "Work",
      nameKey: "forged",
    });
    expect(result).toEqual({ name: "Work" });
  });
});
