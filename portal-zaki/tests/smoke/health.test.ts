import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { db } from "@/lib/db/index";

describe("GET /api/health", () => {
  afterAll(async () => {
    await db.$client.end({ timeout: 5 });
  });

  it("returns HTTP 200 with ok:true", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(["ok", "degraded"]).toContain(body.data.status);
  });
});
