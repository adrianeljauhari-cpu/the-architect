import { NextResponse } from "next/server";
import { _testOtpMailbox } from "@/lib/auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * DEV/TEST ONLY. Returns the last activation OTP captured in memory so the E2E
 * suite can complete the login flow without a mail transport. Returns 404 in
 * production, where OTPs are delivered by Resend and never exposed.
 */
export function GET(req: Request) {
  if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: { code: "not_found" } },
      { status: 404 },
    );
  }
  const email = new URL(req.url).searchParams.get("email") ?? "";
  const otp = _testOtpMailbox.get(email);
  if (!otp) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: { otp } }, { status: 200 });
}
