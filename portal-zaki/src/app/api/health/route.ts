import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/reconcile";

export const runtime = "nodejs";

/**
 * Liveness + mirror freshness (blueprint §16). Returns 200 with `status: 'ok'`
 * when the mirror is fresh, `status: 'degraded'` when the newest `synced_at`
 * exceeds the freshness window, and 500 only when the database is unreachable.
 */
export async function GET() {
  try {
    const health = await checkHealth();
    return NextResponse.json({ ok: true, data: health }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "internal", message: "health check failed" },
      },
      { status: 500 },
    );
  }
}
