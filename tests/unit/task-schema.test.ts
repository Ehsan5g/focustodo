import { describe, expect, it } from "vitest";

import {
  createTaskSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/validation/task-schema";

/**
 * Unit tests (F003 T004, D1/D2/D12): shared task schemas — the single Zod
 * source of truth (constitution II). Title 1–120 after trimming; description
 * optional ≤1000, empty → null; dueDate strict YYYY-MM-DD → UTC-midnight
 * Date (impossible calendar days rejected); priority enum default MEDIUM;
 * status enum default TODO — creation accepts any valid initial status
 * (clarified FR-001).
 */

const VALID_TITLE = "Buy groceries";

function baseFields(overrides: Record<string, unknown> = {}) {
  return { title: VALID_TITLE, ...overrides };
}

describe("task-schema (research D1/D2 — shared Zod source of truth)", () => {
  describe("title", () => {
    it("accepts a plain title", () => {
      const result = createTaskSchema.safeParse(baseFields());
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.title).toBe(VALID_TITLE);
    });

    it("trims surrounding whitespace", () => {
      const result = createTaskSchema.safeParse(
        baseFields({ title: "  Trimmed title  " }),
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.title).toBe("Trimmed title");
    });

    it("rejects an empty and a whitespace-only title", () => {
      expect(
        createTaskSchema.safeParse(baseFields({ title: "" })).success,
      ).toBe(false);
      expect(
        createTaskSchema.safeParse(baseFields({ title: "   " })).success,
      ).toBe(false);
    });

    it("accepts exactly 120 characters and rejects 121", () => {
      expect(
        createTaskSchema.safeParse(baseFields({ title: "a".repeat(120) }))
          .success,
      ).toBe(true);
      expect(
        createTaskSchema.safeParse(baseFields({ title: "a".repeat(121) }))
          .success,
      ).toBe(false);
    });
  });

  describe("description", () => {
    it("is optional and defaults to null", () => {
      const result = createTaskSchema.safeParse(baseFields());
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.description).toBeNull();
    });

    it("accepts up to 1000 characters", () => {
      expect(
        createTaskSchema.safeParse(
          baseFields({ description: "d".repeat(1000) }),
        ).success,
      ).toBe(true);
    });

    it("rejects more than 1000 characters", () => {
      expect(
        createTaskSchema.safeParse(
          baseFields({ description: "d".repeat(1001) }),
        ).success,
      ).toBe(false);
    });

    it("maps an empty string to null (clearing stores null, FR-007)", () => {
      const result = createTaskSchema.safeParse(
        baseFields({ description: "" }),
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.description).toBeNull();
    });
  });

  describe("dueDate", () => {
    it("is optional and defaults to null", () => {
      const result = createTaskSchema.safeParse(baseFields());
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.dueDate).toBeNull();
    });

    it("normalizes an empty string (a cleared date input) to null", () => {
      const result = createTaskSchema.safeParse(baseFields({ dueDate: "" }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.dueDate).toBeNull();
    });

    it("normalizes YYYY-MM-DD to a UTC-midnight Date", () => {
      const result = createTaskSchema.safeParse(
        baseFields({ dueDate: "2026-03-15" }),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dueDate).toBeInstanceOf(Date);
        expect(result.data.dueDate?.toISOString()).toBe(
          "2026-03-15T00:00:00.000Z",
        );
      }
    });

    it("rejects malformed dates", () => {
      expect(
        createTaskSchema.safeParse(baseFields({ dueDate: "15/03/2026" }))
          .success,
      ).toBe(false);
      expect(
        createTaskSchema.safeParse(baseFields({ dueDate: "2026-3-15" }))
          .success,
      ).toBe(false);
      expect(
        createTaskSchema.safeParse(baseFields({ dueDate: "not-a-date" }))
          .success,
      ).toBe(false);
    });

    it("rejects impossible calendar days like 2026-02-30", () => {
      expect(
        createTaskSchema.safeParse(baseFields({ dueDate: "2026-02-30" }))
          .success,
      ).toBe(false);
    });
  });

  describe("priority", () => {
    it("defaults to MEDIUM when omitted", () => {
      const result = createTaskSchema.safeParse(baseFields());
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.priority).toBe("MEDIUM");
    });

    it("accepts every enum value", () => {
      for (const priority of ["LOW", "MEDIUM", "HIGH"]) {
        const result = createTaskSchema.safeParse(baseFields({ priority }));
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.priority).toBe(priority);
      }
    });

    it("rejects an unknown priority", () => {
      expect(
        createTaskSchema.safeParse(baseFields({ priority: "URGENT" })).success,
      ).toBe(false);
    });
  });

  describe("status (clarified FR-001 — any valid initial status at creation)", () => {
    it("defaults to TODO when omitted", () => {
      const result = createTaskSchema.safeParse(baseFields());
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe("TODO");
    });

    it("accepts any valid initial status on createTaskSchema", () => {
      for (const status of ["TODO", "IN_PROGRESS", "COMPLETED"]) {
        const result = createTaskSchema.safeParse(baseFields({ status }));
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.status).toBe(status);
      }
    });

    it("rejects an unknown status", () => {
      expect(
        createTaskSchema.safeParse(baseFields({ status: "DONE" })).success,
      ).toBe(false);
    });
  });

  describe("updateTaskSchema", () => {
    it("re-uses the same field rules", () => {
      const result = updateTaskSchema.safeParse({
        title: "Edited title",
        description: "Updated",
        dueDate: "2026-06-01",
        priority: "HIGH",
        status: "IN_PROGRESS",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Edited title");
        expect(result.data.priority).toBe("HIGH");
        expect(result.data.status).toBe("IN_PROGRESS");
        expect(result.data.dueDate?.toISOString()).toBe(
          "2026-06-01T00:00:00.000Z",
        );
      }
    });

    it("rejects the same invalid shapes as createTaskSchema", () => {
      expect(
        updateTaskSchema.safeParse(baseFields({ title: "" })).success,
      ).toBe(false);
      expect(
        updateTaskSchema.safeParse(baseFields({ dueDate: "2026-02-30" }))
          .success,
      ).toBe(false);
    });
  });

  describe("taskIdSchema", () => {
    it("accepts a non-empty string", () => {
      expect(taskIdSchema.safeParse("cuid-123").success).toBe(true);
    });

    it("rejects empty and non-string ids", () => {
      expect(taskIdSchema.safeParse("").success).toBe(false);
      expect(taskIdSchema.safeParse("   ").success).toBe(false);
      expect(taskIdSchema.safeParse(42).success).toBe(false);
    });
  });
});
