import { NextResponse } from "next/server";

/**
 * Liveness probe. In step 1 it only proves the route handler serves; step 13
 * (E2-T7) extends it with database reachability and mirror freshness.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, data: { status: "ok" } },
    { status: 200 },
  );
}
