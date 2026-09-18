import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — connectivity proof (FR-009, D11, US3 scenarios 1–4).
 * Scratch table `health_check` is a code constant (constitution I: values
 * bound as parameters, identifier from code, never user input). Upserts the
 * singleton row id=1, incrementing attempts. Returns 200 with the counter,
 * or 503 with a remediation hint — never raw internals.
 */

const REMEDIATION_HINT = "Start the database with: docker compose start db";

export async function GET() {
  try {
    const { db } = await import("@/server/db");
    await db.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS health_check (id integer primary key, attempts integer not null, checked_at timestamptz not null)",
    );
    await db.$executeRaw`INSERT INTO health_check (id, attempts, checked_at)
      VALUES (1, 1, now())
      ON CONFLICT (id)
      DO UPDATE SET attempts = health_check.attempts + 1, checked_at = now()`;
    const rows = await db.$queryRaw<{ attempts: number; checked_at: Date }[]>`
      SELECT attempts, checked_at FROM health_check WHERE id = 1`;
    const row = rows[0];
    if (!row) throw new Error("health_check row missing after upsert");
    return NextResponse.json({
      status: "ok",
      attempts: row.attempts,
      lastCheckedAt: row.checked_at,
    });
  } catch {
    return NextResponse.json(
      { status: "error", hint: REMEDIATION_HINT },
      { status: 503 },
    );
  }
}
