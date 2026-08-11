import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/ingest/route";
import { db } from "@/lib/db/index";
import { ingestEvents, products, syncState } from "@/lib/db/schema";

const SECRET = String(process.env.SYNC_SHARED_SECRET);
const EV_OK = "11111111-1111-4111-8111-111111111111";
const EV_DUP = "33333333-3333-4333-8333-333333333333";
const TEST_ARTS = ["ING-1", "ING-2", "ING-3"];

function sign(raw: string) {
  return `sha256=${crypto.createHmac("sha256", SECRET).update(raw).digest("hex")}`;
}

function post(raw: string, signature: string | null) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature) headers["x-signature"] = signature;
  return POST(
    new Request("http://localhost/api/ingest", {
      method: "POST",
      body: raw,
      headers,
    }),
  );
}

function artBatch(eventId: string, arts: string[], cursor: string) {
  return JSON.stringify({
    event_id: eventId,
    source: "art",
    cursor,
    rows: arts.map((coArt, i) => ({
      coArt,
      artDes: `TEST ${coArt}`,
      precVta1: 100 + i,
      stockAct: 10,
      stockCom: 0,
      anulado: false,
      rowIdHex: `0x000000000000000${i + 1}`,
    })),
  });
}

async function cleanup() {
  await db.delete(products).where(inArray(products.coArt, TEST_ARTS));
  await db
    .delete(ingestEvents)
    .where(inArray(ingestEvents.eventId, [EV_OK, EV_DUP]));
}

describe("POST /api/ingest", () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await db.$client.end({ timeout: 5 });
  });

  it("accepts a validly-signed art batch, upserts rows, advances the cursor", async () => {
    const raw = artBatch(EV_OK, ["ING-1", "ING-2"], "0x00000000000000AA");
    const res = await post(raw, sign(raw));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: { rowsApplied: 2, deduped: false },
    });

    const rows = await db
      .select()
      .from(products)
      .where(inArray(products.coArt, ["ING-1", "ING-2"]));
    expect(rows).toHaveLength(2);

    const [state] = await db
      .select()
      .from(syncState)
      .where(eq(syncState.source, "art"));
    expect(state.lastRowIdHex).toBe("0x00000000000000AA");
  });

  it("rejects an invalid signature with 401 and writes zero rows", async () => {
    const raw = artBatch(EV_OK, ["ING-3"], "0x00000000000000BB");
    const res = await post(raw, "sha256=deadbeef");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_signature");

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.coArt, "ING-3"));
    expect(rows).toHaveLength(0);
  });

  it("is idempotent on a replayed event_id", async () => {
    const raw = artBatch(EV_DUP, ["ING-1", "ING-2"], "0x00000000000000CC");

    const first = await post(raw, sign(raw));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      ok: true,
      data: { rowsApplied: 2, deduped: false },
    });

    const second = await post(raw, sign(raw));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      ok: true,
      data: { rowsApplied: 0, deduped: true },
    });

    const events = await db
      .select()
      .from(ingestEvents)
      .where(eq(ingestEvents.eventId, EV_DUP));
    expect(events).toHaveLength(1);

    const rows = await db
      .select()
      .from(products)
      .where(inArray(products.coArt, ["ING-1", "ING-2"]));
    expect(rows).toHaveLength(2);
  });

  it("rejects malformed JSON with 400 bad_request", async () => {
    const raw = "{ this is not json";
    const res = await post(raw, sign(raw));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("rejects a batch whose rows fail validation, writing nothing", async () => {
    const raw = JSON.stringify({
      event_id: EV_OK,
      source: "art",
      cursor: "0x00000000000000DD",
      rows: [{ coArt: "ING-1", artDes: "missing prec/stock" }],
    });
    const res = await post(raw, sign(raw));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_request");

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.coArt, "ING-1"));
    expect(rows).toHaveLength(0);
  });
});
