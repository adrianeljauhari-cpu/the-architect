import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/index";
import { appUsers, orderLines, orders, products } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import { checkHealth, MIRROR_FRESHNESS_MS, reconcile } from "@/lib/reconcile";

const ORDER_ID = "bbbbbbbb-0000-4000-8000-000000000001";

async function ensureUser(coCli: string): Promise<string> {
  await db
    .insert(appUsers)
    .values({ coCli, role: "client" })
    .onConflictDoNothing({
      target: appUsers.coCli,
    });
  const [row] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.coCli, coCli))
    .limit(1);
  return row.id;
}

describe("observability: health and reconciliation", () => {
  beforeAll(async () => {
    await seed();
    // Simulate a fresh sync: re-seed skips existing rows (onConflictDoNothing),
    // so stamp the mirror as just-synced for the freshness assertion.
    await db.update(products).set({ syncedAt: new Date() });
    const appUserId = await ensureUser("0370");
    await db.delete(orderLines).where(eq(orderLines.orderId, ORDER_ID));
    await db.delete(orders).where(eq(orders.id, ORDER_ID));
    await db.insert(orders).values({
      id: ORDER_ID,
      orderNumber: "PZ-REC-1",
      appUserId,
      coCli: "0370",
      usdBsUsed: "40.250000",
      applied1pct: false,
      subtotal: "100.00",
      total: "100.00",
      status: "submitted",
    });
    await db.insert(orderLines).values({
      orderId: ORDER_ID,
      coArt: "A018", // seeded product_caps porc_max 15
      artDes: "CLONAZEPAM 2 MG X 30 TAB ( ZAKIMED )",
      qty: "1",
      precVta1: "1875.40",
      cascade: "0+0+10+0", // 10% discount, within the 15% cap
      unitFrozen: "1687.86",
      lineNet: "100.00",
    });
  });
  afterAll(async () => {
    await db.delete(orderLines).where(eq(orderLines.orderId, ORDER_ID));
    await db.delete(orders).where(eq(orders.id, ORDER_ID));
    await db.$client.end({ timeout: 5 });
  });

  it("reports ok for a fresh mirror and degraded past the threshold", async () => {
    const fresh = await checkHealth(new Date());
    expect(fresh.status).toBe("ok");

    const stale = await checkHealth(
      new Date(Date.now() + MIRROR_FRESHNESS_MS + 60_000),
    );
    expect(stale.status).toBe("degraded");
  });

  it("finds zero orders without lines and zero lines exceeding porc_max on a clean dataset", async () => {
    const result = await reconcile();
    expect(result.ordersWithoutLines).toBe(0);
    expect(result.linesOverCap).toBe(0);
  });
});
