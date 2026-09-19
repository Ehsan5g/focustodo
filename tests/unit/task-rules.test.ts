import { describe, expect, it } from "vitest";

import { isOverdue, validateTransition } from "@/server/tasks/rules";

/**
 * Unit tests (F003 T005, D1/D2/D12): the shared pure rules.
 *
 * `validateTransition` — the FULL 3×3 matrix (data-model.md "Status
 * lifecycle"): allowed forward pairs (TODO→IN_PROGRESS, TODO→COMPLETED,
 * IN_PROGRESS→COMPLETED), the reopen reset (COMPLETED→TODO), and every
 * same-status no-op; rejected backward pairs (IN_PROGRESS→TODO,
 * COMPLETED→IN_PROGRESS) with a field-level `status` message.
 *
 * `isOverdue` — calendar-day comparison only (never Date.now() inside
 * the function; `today` is injected): yesterday/today/tomorrow, month and
 * year boundaries, null dueDate, completed tasks never overdue.
 */

describe("validateTransition (research D2 — one shared pure rule)", () => {
  it("allows every forward transition", () => {
    expect(validateTransition("TODO", "IN_PROGRESS")).toBe(true);
    expect(validateTransition("TODO", "COMPLETED")).toBe(true);
    expect(validateTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("allows the reopen reset COMPLETED → TODO", () => {
    expect(validateTransition("COMPLETED", "TODO")).toBe(true);
  });

  it("allows every same-status no-op", () => {
    expect(validateTransition("TODO", "TODO")).toBe(true);
    expect(validateTransition("IN_PROGRESS", "IN_PROGRESS")).toBe(true);
    expect(validateTransition("COMPLETED", "COMPLETED")).toBe(true);
  });

  it("rejects every backward transition", () => {
    expect(validateTransition("IN_PROGRESS", "TODO")).toBe(false);
    expect(validateTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
  });
});

describe("isOverdue (research D1 — derived at render, calendar days)", () => {
  // Fixed anchor: 2026-03-15 is a Sunday; the month/year boundary pair is
  // Dec 31 2026 → Jan 1 2027 (D12's calendar-boundary matrix).
  const today = new Date("2026-03-15T12:00:00.000Z");

  it("is true when the due day is strictly before today and the task is not completed", () => {
    expect(isOverdue(new Date("2026-03-14"), "TODO", today)).toBe(true);
    expect(isOverdue(new Date("2026-03-14"), "IN_PROGRESS", today)).toBe(true);
  });

  it("is false when the due day IS today (due today ≠ overdue)", () => {
    expect(isOverdue(new Date("2026-03-15"), "TODO", today)).toBe(false);
  });

  it("is false when the due day is after today", () => {
    expect(isOverdue(new Date("2026-03-16"), "TODO", today)).toBe(false);
  });

  it("compares CALENDAR days — a clock-time anchor does not leak into the comparison", () => {
    // Due 2026-03-14 with any time-of-day anchor is still overdue;
    // due 2026-03-15 23:59 UTC stored as its calendar day is not overdue.
    expect(isOverdue(new Date("2026-03-14T23:59:00.000Z"), "TODO", today)).toBe(
      true,
    );
    expect(isOverdue(new Date("2026-03-15T23:59:00.000Z"), "TODO", today)).toBe(
      false,
    );
  });

  it("crosses the month boundary (Feb 28 → Mar 1) correctly", () => {
    const march1 = new Date("2026-03-01T00:00:00.000Z");
    expect(isOverdue(new Date("2026-02-28"), "TODO", march1)).toBe(true);
    expect(isOverdue(new Date("2026-03-01"), "TODO", march1)).toBe(false);
  });

  it("crosses the year boundary (Dec 31 → Jan 1) correctly", () => {
    const jan1 = new Date("2027-01-01T00:00:00.000Z");
    expect(isOverdue(new Date("2026-12-31"), "TODO", jan1)).toBe(true);
    expect(isOverdue(new Date("2027-01-01"), "TODO", jan1)).toBe(false);
  });

  it("is false for a null dueDate", () => {
    expect(isOverdue(null, "TODO", today)).toBe(false);
  });

  it("is NEVER true for a completed task, even overdue by calendar day", () => {
    expect(isOverdue(new Date("2026-03-14"), "COMPLETED", today)).toBe(false);
    expect(isOverdue(new Date("2020-01-01"), "COMPLETED", today)).toBe(false);
  });
});
