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
 *   UTC-midnight Date; impossible days like 2026-02-30 are rejected
 * - priority: enum, default MEDIUM (FR-003)
 * - status: default TODO; creation accepts any valid initial status
 *   (clarified FR-001). Transitions after creation are governed by the pure
 *   `validateTransition` rule, not by these schemas.
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
  dueDate: calendarDaySchema.nullish().transform((value) => value ?? null),
  priority: taskPrioritySchema.default("MEDIUM"),
  status: taskStatusSchema.default("TODO"),
};

export const createTaskSchema = z.object(baseTaskFields);
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Update: partial — only provided keys are changed; explicit null clears. */
export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskIdSchema = z
  .string({ error: "Task id is required" })
  .trim()
  .min(1, "Task id is required");
