import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getAccountSummary,
  getClientOrder,
  getClientOrders,
  getClientProofs,
} from "@/lib/catalog/queries";
import { db } from "@/lib/db/index";
import { appUsers, orderLines, orders, paymentProofs } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";

let appUser0370: string;
const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000370";

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

async function cleanup() {
  await db.delete(orderLines).where(eq(orderLines.orderId, ORDER_ID));
  await db.delete(orders).where(eq(orders.id, ORDER_ID));
  await db.delete(paymentProofs).where(inArray(paymentProofs.coCli, ["0370"]));
}

describe("account: credit, balance and history", () => {
  beforeAll(async () => {
    await seed();
    appUser0370 = await ensureUser("0370");
    await cleanup();
    await db.insert(orders).values({
      id: ORDER_ID,
      orderNumber: "PZ-TEST-0370",
      appUserId: appUser0370,
      coCli: "0370",
      usdBsUsed: "40.250000",
      applied1pct: true,
      subtotal: "1000.00",
      total: "990.00",
      status: "submitted",
    });
    await db.insert(orderLines).values({
      orderId: ORDER_ID,
      coArt: "A001",
      artDes: "OMEPRAZOL 20 MG X 10 CAP ( ZAKIMED )",
      qty: "1",
      precVta1: "2165.23",
      cascade: "0+0+0+12",
      unitFrozen: "1905.40",
      lineNet: "1000.00",
    });
    await db.insert(paymentProofs).values({
      appUserId: appUser0370,
      coCli: "0370",
      amount: "500.00",
      currency: "BS",
      method: "transfer",
      reference: "REF-ACC-1",
      imageUrl: "https://demo.supabase.co/sign/x?token=abc",
    });
  });
  afterAll(async () => {
    await cleanup();
    await db.$client.end({ timeout: 5 });
  });

  it("shows the client's mont_cre, saldo and plaz_pag from the mirror", async () => {
    const summary = await getAccountSummary("0370");
    expect(summary).not.toBeNull();
    expect(Number(summary?.montCre)).toBe(5_000_000);
    expect(Number(summary?.saldo)).toBe(1_200_000);
    expect(summary?.plazPag).toBe(30);
    expect(summary?.sincredito).toBe(false);
  });

  it("labels a sincredito client as contado", async () => {
    const summary = await getAccountSummary("0002");
    expect(summary?.sincredito).toBe(true);
  });

  it("lists only the client's own orders and proofs", async () => {
    const own = await getClientOrders("0370");
    expect(own.some((o) => o.id === ORDER_ID)).toBe(true);

    const others = await getClientOrders("0002");
    expect(others.some((o) => o.id === ORDER_ID)).toBe(false);

    const proofs = await getClientProofs("0370");
    expect(proofs.some((p) => p.reference === "REF-ACC-1")).toBe(true);
  });

  it("returns 404 (null) when a client requests another client's order by id", async () => {
    expect(await getClientOrder("0002", ORDER_ID)).toBeNull();

    const mine = await getClientOrder("0370", ORDER_ID);
    expect(mine?.order.orderNumber).toBe("PZ-TEST-0370");
    expect(mine?.lines).toHaveLength(1);
  });
});
