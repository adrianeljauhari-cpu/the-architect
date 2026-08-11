import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { apply, INGEST_SOURCES } from "@/lib/ingest/apply";

export const runtime = "nodejs";

/**
 * The single write path to the mirror (blueprint §5). The HMAC over the RAW body
 * is verified BEFORE the body is parsed as trusted — verifying after parsing is a
 * vulnerability, not an ordering detail. On any failure, zero rows are written.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const envelopeSchema = z.object({
  event_id: z.string().regex(UUID),
  source: z.enum(INGEST_SOURCES),
  rows: z.array(z.record(z.string(), z.unknown())),
  cursor: z.string(),
});

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/** Constant-time HMAC check over the raw request body. */
function signatureValid(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const [scheme, provided] = header.split("=");
  if (scheme !== "sha256" || !provided) return false;

  const expected = crypto
    .createHmac("sha256", env.SYNC_SHARED_SECRET)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!signatureValid(rawBody, req.headers.get("x-signature"))) {
    return fail(401, "invalid_signature", "HMAC signature missing or invalid");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return fail(400, "bad_request", "body is not valid JSON");
  }

  const parsed = envelopeSchema.safeParse(json);
  if (!parsed.success) {
    return fail(400, "bad_request", "batch envelope failed validation");
  }

  try {
    const result = await apply(
      parsed.data.source,
      parsed.data.rows,
      parsed.data.cursor,
      parsed.data.event_id,
    );
    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(400, "bad_request", "one or more rows failed validation");
    }
    return fail(500, "internal", "ingest failed");
  }
}
