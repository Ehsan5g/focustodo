import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — connectivity contract (contracts/commands.md, SC-002):
 * 200 {"status":"ok","database":"connected"} or
 * 503 {"status":"error","database":"disconnected","detail":"..."}.
 */
export async function GET() {
  try {
    const { db } = await import("@/server/db");
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
