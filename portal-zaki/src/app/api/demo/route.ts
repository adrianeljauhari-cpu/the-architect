import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * TEMPORARY demo access — REMOVE before real launch.
 * `/api/demo?key=<SYNC_SHARED_SECRET>` sets a cookie that lets a visitor browse
 * the shop read-only as a demo client, without the email OTP. Gated by the
 * existing shared secret so it is not publicly guessable.
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const secret = process.env.SYNC_SHARED_SECRET ?? "";
  if (!secret || key !== secret) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found" } },
      { status: 404 },
    );
  }
  const jar = await cookies();
  jar.set("pz_demo", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return NextResponse.redirect(new URL("/catalogo", req.url));
}
