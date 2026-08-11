import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { connectWith, ProfitConnectionError, rtrim } from "@/agent/profit";
import { buildBatch, pushBatch, signBody } from "@/agent/push";
import {
  type CursorStore,
  type Pusher,
  type Reader,
  runOnce,
} from "@/agent/sync";

const SECRET = String(process.env.SYNC_SHARED_SECRET);
const INGEST_URL = String(process.env.INGEST_URL);

function fakeFetch(captured: { url?: string; init?: RequestInit }) {
  return (async (url: string, init: RequestInit) => {
    captured.url = url;
    captured.init = init;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: { rowsApplied: 1, deduped: false },
      }),
    };
  }) as unknown as typeof fetch;
}

describe("agent push", () => {
  it("signs the exact body with an HMAC the ingest route accepts (acceptance 1)", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const batch = buildBatch(
      "art",
      [
        {
          coArt: "A001",
          artDes: "X",
          precVta1: 1,
          stockAct: 1,
          stockCom: 0,
          rowIdHex: "0x01",
        },
      ],
      "0x00000000000000AA",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );

    await pushBatch(batch, fakeFetch(captured));

    expect(captured.url).toBe(INGEST_URL);

    const init = captured.init as RequestInit;
    const body = init.body as string;
    const header = (init.headers as Record<string, string>)["x-signature"];

    // the signature is a correct HMAC over the exact bytes sent — what the route verifies
    const expected = `sha256=${crypto.createHmac("sha256", SECRET).update(body).digest("hex")}`;
    expect(header).toBe(expected);
    expect(header).toBe(signBody(body));

    // batch shape
    expect(JSON.parse(body)).toEqual({
      event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "art",
      cursor: "0x00000000000000AA",
      rows: [
        {
          coArt: "A001",
          artDes: "X",
          precVta1: 1,
          stockAct: 1,
          stockCom: 0,
          rowIdHex: "0x01",
        },
      ],
    });
  });

  it("advances the local cursor only after the push is accepted (acceptance 2)", async () => {
    const store: CursorStore = {
      get: vi.fn(async () => "0x0000000000000000"),
      set: vi.fn(async () => {}),
    };
    const reader: Reader = {
      read: vi.fn(async () => ({
        rows: [{ coArt: "A001" }],
        cursor: "0x00000000000000BB",
      })),
    };
    const pusher: Pusher = { push: vi.fn(async () => {}) };

    await runOnce({ store, reader, pusher, sources: ["art"] });

    expect(pusher.push).toHaveBeenCalledWith(
      "art",
      [{ coArt: "A001" }],
      "0x00000000000000BB",
    );
    expect(store.set).toHaveBeenCalledWith("art", "0x00000000000000BB");
  });

  it("does not push or advance when a source has no new rows", async () => {
    const store: CursorStore = {
      get: vi.fn(async () => "0x01"),
      set: vi.fn(async () => {}),
    };
    const reader: Reader = {
      read: vi.fn(async () => ({ rows: [], cursor: "0x01" })),
    };
    const pusher: Pusher = { push: vi.fn(async () => {}) };

    await runOnce({ store, reader, pusher, sources: ["art"] });

    expect(pusher.push).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("right-trims space-padded char codes (acceptance 4)", () => {
    expect(rtrim("A001      ")).toBe("A001");
    expect(rtrim("0370  ")).toBe("0370");
    expect(rtrim("no-padding")).toBe("no-padding");
    expect(rtrim(null)).toBeNull();
    expect(rtrim(undefined)).toBeNull();
  });

  it("surfaces a named ProfitConnectionError on connection failure (acceptance 3)", async () => {
    process.env.PROFIT_SQL_HOST = "127.0.0.1";
    process.env.PROFIT_SQL_USER = "u";
    process.env.PROFIT_SQL_PASSWORD = "p";
    process.env.PROFIT_SQL_DATABASE = "d";

    await expect(
      connectWith(async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).rejects.toBeInstanceOf(ProfitConnectionError);
  });
});
