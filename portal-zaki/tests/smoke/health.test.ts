import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns HTTP 200 with ok:true", async () => {
    const res = GET();

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { status: "ok" } });
  });
});
