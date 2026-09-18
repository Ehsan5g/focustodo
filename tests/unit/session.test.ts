import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  deleteSession,
  validateSession,
} from "@/server/auth/session";

/**
 * Unit tests (T012, D2/D12): session service against a mocked Prisma client.
 * Sliding window: a valid session is returned AND extended to now + 30 days;
 * expired/missing sessions return null and the stale row is deleted.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const validRow = {
  id: "sess-valid",
  userId: "user-1",
  expiresAt: new Date(Date.now() + 1000),
  createdAt: new Date(),
};

// Minimal shape the service uses; cast keeps the test honest about usage.
function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    session: {
      findUnique: vi.fn().mockResolvedValue(validRow),
      update: vi.fn().mockResolvedValue(validRow),
      delete: vi.fn().mockResolvedValue(validRow),
      create: vi.fn().mockResolvedValue(validRow),
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

import { setDbForTests } from "@/server/auth/session";

describe("session service (research D2 — sliding 30-day window)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createSession inserts a row with expiresAt = now + 30 days", async () => {
    const db = makeDb({ create: vi.fn().mockResolvedValue(validRow) });
    setDbForTests(db as never);
    const session = await createSession("user-1");
    expect(session).toEqual(validRow);
    const arg = db.session.create.mock.calls[0]?.[0];
    const expected = Date.now() + THIRTY_DAYS_MS;
    expect(Math.abs(arg.data.expiresAt.getTime() - expected)).toBeLessThan(
      5000,
    );
    expect(arg.data.userId).toBe("user-1");
  });

  it("validateSession returns the row AND extends expiresAt (one renewal write)", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    const result = await validateSession("sess-valid");
    expect(result).toEqual(validRow);
    expect(db.session.update).toHaveBeenCalledTimes(1);
    const arg = db.session.update.mock.calls[0]?.[0];
    expect(arg.where.id).toBe("sess-valid");
    expect(
      Math.abs(arg.data.expiresAt.getTime() - (Date.now() + THIRTY_DAYS_MS)),
    ).toBeLessThan(5000);
  });

  it("validateSession returns null AND deletes an expired row", async () => {
    const expired = { ...validRow, expiresAt: new Date(Date.now() - 1000) };
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue(expired) });
    setDbForTests(db as never);
    expect(await validateSession("sess-valid")).toBeNull();
    expect(db.session.delete).toHaveBeenCalledWith({
      where: { id: "sess-valid" },
    });
    expect(db.session.update).not.toHaveBeenCalled();
  });

  it("validateSession returns null for a missing row (no delete attempted)", async () => {
    const db = makeDb({ findUnique: vi.fn().mockResolvedValue(null) });
    setDbForTests(db as never);
    expect(await validateSession("nope")).toBeNull();
    expect(db.session.delete).not.toHaveBeenCalled();
  });

  it("deleteSession removes the row (multi-tab revocation = one DELETE)", async () => {
    const db = makeDb();
    setDbForTests(db as never);
    await deleteSession("sess-valid");
    expect(db.session.delete).toHaveBeenCalledWith({
      where: { id: "sess-valid" },
    });
  });
});
