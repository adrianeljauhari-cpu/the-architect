import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addToCart, getOrCreateOpenCart } from "@/lib/cart/server";
import { db } from "@/lib/db/index";
import {
  appUsers,
  cartLines,
  carts,
  orderLines,
  orders,
} from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import type { Quotation } from "@/lib/email";
import { submitOrder } from "@/lib/orders/server";

const AT = new Date("2026-08-11T12:00:00Z");
let owner0370: { id: string; co_cli: string }; // cond_1pct = true
let owner0002: { id: string; co_cli: string }; // cond_1pct = false

async function ensureUser(
  coCli: string,
): Promise<{ id: string; co_cli: string }> {
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
  return { id: row.id, co_cli: coCli };
}

async function clearOrdersFor(appUserId: string) {
  const os = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.appUserId, appUserId));
  if (os.length) {
    await db.delete(orderLines).where(
      inArray(
        orderLines.orderId,
        os.map((o) => o.id),
      ),
    );
    await db.delete(orders).where(eq(orders.appUserId, appUserId));
  }
  await db.delete(carts).where(eq(carts.appUserId, appUserId));
}

function collector() {
  const sent: Quotation[] = [];
  return { sent, sendEmail: async (q: Quotation) => void sent.push(q) };
}

describe("quote submission", () => {
  beforeAll(async () => {
    await seed();
    owner0370 = await ensureUser("0370");
    owner0002 = await ensureUser("0002");
  });
  beforeEach(async () => {
    await clearOrdersFor(owner0370.id);
    await clearOrdersFor(owner0002.id);
  });
  afterAll(async () => {
    await clearOrdersFor(owner0370.id);
    await clearOrdersFor(owner0002.id);
    await db.$client.end({ timeout: 5 });
  });

  it("creates one order with one frozen line per cart line and emails the quotation", async () => {
    await addToCart(owner0370, "A001", 2);
    await addToCart(owner0370, "A002", 3);
    const mail = collector();

    const result = await submitOrder(owner0370, {
      sendEmail: mail.sendEmail,
      at: AT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));
    expect(orderRows).toHaveLength(1);

    const lines = await db
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, result.orderId));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(Number(line.unitFrozen)).toBeGreaterThan(0);
      expect(line.cascade).toMatch(/^\d+\+\d+\+\d+\+\d+$/);
    }

    // rate frozen to the mirror rate (seed = 40.25)
    expect(Number(orderRows[0].usdBsUsed)).toBe(40.25);

    // email dispatched once, cart marked submitted
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].orderNumber).toBe(result.orderNumber);
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.appUserId, owner0370.id));
    expect(cart.status).toBe("submitted");
  });

  it("applies the 1% only for cond_1pct clients", async () => {
    await addToCart(owner0370, "A001", 2);
    const r1 = await submitOrder(owner0370, {
      sendEmail: collector().sendEmail,
      at: AT,
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const [o1] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, r1.orderId));
    expect(o1.applied1pct).toBe(true);
    expect(Number(o1.total)).toBeCloseTo(Number(o1.subtotal) * 0.99, 2);

    await addToCart(owner0002, "A001", 2);
    const r2 = await submitOrder(owner0002, {
      sendEmail: collector().sendEmail,
      at: AT,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const [o2] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, r2.orderId));
    expect(o2.applied1pct).toBe(false);
    expect(o2.total).toBe(o2.subtotal);
  });

  it("creates no order and reports offending lines for an out-of-stock product", async () => {
    // A010 is seeded with stock 0/0 → disponible 0. Insert the line directly to
    // get past the cart's own guard, so we exercise submit's re-validation.
    const cartId = await getOrCreateOpenCart(owner0370.id);
    await db.insert(cartLines).values({ cartId, coArt: "A010", qty: "5" });
    const mail = collector();

    const result = await submitOrder(owner0370, {
      sendEmail: mail.sendEmail,
      at: AT,
    });
    expect(result).toEqual({
      ok: false,
      reason: "unavailable",
      offending: ["A010"],
    });
    expect(mail.sent).toHaveLength(0);

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.appUserId, owner0370.id));
    expect(orderRows).toHaveLength(0);
  });
});
