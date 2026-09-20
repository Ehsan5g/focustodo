import { z } from "zod";

import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";

/**
 * Shared task schemas (feature 003-task-management, D1/D2/D12) — the single
 * Zod source of truth for task create/update and id parsing, shared between
 * client and server (constitution II). The server re-validates every action
 * input even though the client also validates.
 *
 * Rules (data-model.md, spec clarifications):
 * - title: 1–120 characters after trimming (FR-002)
 * - description: optional, ≤1000 characters; an empty string normalizes to
 *   `null` so "clearing" and "never set" are the same stored state (FR-007)
 * - dueDate: strict `YYYY-MM-DD` calendar day (research D1) — normalized to a
 *   UTC-midnight Date; impossible days like 2026-02-30 are rejected; an empty
 *   string (a cleared `<input type="date">`) normalizes to `null` like
 *   description (FR-007)
 * - priority: enum, default MEDIUM (FR-003)
 * - status: default TODO; creation accepts any valid initial status
 *   (clarified FR-001). Transitions after creation are governed by the pure
 *   `validateTransition` rule, not by these schemas.
 * - categoryId (F004 T018): optional on BOTH schemas — the "No category"
 *   select value (empty string) normalizes to null (FR-006: clearing is a
 *   first-class choice); a non-empty string is the id of an OWNED category,
 *   with ownership resolved in the task service BEFORE any write (FR-005).
 *   On update, an absent categoryId means "no change" (partial semantics).
 */

export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 1000;

/** Strict calendar-day pattern: `YYYY-MM-DD`, zero-padded month and day. */
const CALENDAR_DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Parse a strict YYYY-MM-DD string into a UTC-midnight Date. Returns null for
 * impossible calendar days (2026-02-30) — the pattern alone cannot catch
 * those, so we re-check the round-trip.
 */
function parseCalendarDay(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().startsWith(value) ? parsed : null;
}

const calendarDaySchema = z
  .string()
  .regex(CALENDAR_DAY_PATTERN, "Due date must be a valid date (YYYY-MM-DD)")
  .refine((value) => parseCalendarDay(value) !== null, {
    message: "Due date must be a valid date (YYYY-MM-DD)",
  })
  .transform((value) => parseCalendarDay(value) as Date);

const taskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
]) satisfies z.ZodType<TaskStatus>;
const taskPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
]) satisfies z.ZodType<TaskPriority>;

const baseTaskFields = {
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(
      TITLE_MAX_LENGTH,
      `Title must be at most ${TITLE_MAX_LENGTH} characters`,
    ),
  description: z
    .string()
    .trim()
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
    )
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null),
  dueDate: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.union([calendarDaySchema, z.null()]),
  ),
  priority: taskPrioritySchema.default("MEDIUM"),
  status: taskStatusSchema.default("TODO"),
  // F004 T018: same preprocess shape as dueDate — the empty "No category"
  // select value and an explicit null both normalize to null; a whitespace
  // only or non-string id is rejected (defense-in-depth — the picker only
  // ever submits "" or a rendered option value).
  categoryId: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.union([z.string().trim().min(1, "Category is required"), z.null()]),
  ),
};

export const createTaskSchema = z.object(baseTaskFields);
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Update: partial — only provided keys are changed; explicit null clears.
 * Built EXPLICITLY with `.optional()` fields rather than `.partial()`: in
 * Zod 4 a partial over defaulted fields still APPLIES the defaults, which
 * would leak priority/status into every update's data. Omitted keys stay
 * absent here ("no change", F003 D2) — including categoryId (F004 T018).
 */
export const updateTaskSchema = z.object({
  title: baseTaskFields.title.optional(),
  description: baseTaskFields.description.optional(),
  dueDate: baseTaskFields.dueDate.optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  categoryId: baseTaskFields.categoryId.optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskIdSchema = z
  .string({ error: "Task id is required" })
  .trim()
  .min(1, "Task id is required");
