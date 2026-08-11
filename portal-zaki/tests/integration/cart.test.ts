import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addToCart, getCart, updateCartLine } from "@/lib/cart/server";
import { getPricingClient } from "@/lib/catalog/queries";
import { db } from "@/lib/db/index";
import { appUsers, cartLines, carts } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import { price } from "@/lib/pricing/price";

const AT = new Date("2026-08-11T12:00:00Z");
let owner: { id: string; co_cli: string };

describe("server-authoritative cart", () => {
  beforeAll(async () => {
    await seed();
    await db
      .insert(appUsers)
      .values({ coCli: "0370", role: "client" })
      .onConflictDoNothing({ target: appUsers.coCli });
    const [row] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.coCli, "0370"))
      .limit(1);
    owner = { id: row.id, co_cli: "0370" };
  });

  beforeEach(async () => {
    await db.delete(carts).where(eq(carts.appUserId, owner.id));
  });

  afterAll(async () => {
    await db.delete(carts).where(eq(carts.appUserId, owner.id));
    await db.$client.end({ timeout: 5 });
  });

  it("recomputes each line price server-side with the client's desc_glob (never a client value)", async () => {
    const add = await addToCart(owner, "A001", 2);
    expect(add.ok).toBe(true);

    const client = await getPricingClient("0370");
    if (!client) throw new Error("missing client");
    const expected = await price(
      client,
      { coArt: "A001", precVta1: "2165.23" },
      2,
      AT,
    );

    const cart = await getCart(owner, AT);
    const line = cart.lines.find((l) => l.coArt === "A001");
    expect(line?.qty).toBe(2);
    expect(line?.lineNet).toBe(expected.lineNet);

    // client 0370 is cond_1pct → total is 1% below subtotal
    expect(cart.applied1pct).toBe(true);
    expect(cart.total).not.toBe(cart.subtotal);
  });

  it("rejects a quantity above disponible and reports the available amount", async () => {
    // A006 seeded stock 150 / committed 5 → disponible 145
    const res = await addToCart(owner, "A006", 200);
    expect(res).toEqual({ ok: false, reason: "oversell", available: 145 });

    const cart = await getCart(owner, AT);
    expect(cart.lines.find((l) => l.coArt === "A006")).toBeUndefined();

    const upd = await updateCartLine(owner, "A006", 300);
    expect(upd).toEqual({ ok: false, reason: "oversell", available: 145 });
  });

  it("keeps one line and sums the quantity when a product is added twice", async () => {
    await addToCart(owner, "A002", 3);
    await addToCart(owner, "A002", 4);

    const cart = await getCart(owner, AT);
    const a002 = cart.lines.filter((l) => l.coArt === "A002");
    expect(a002).toHaveLength(1);
    expect(a002[0].qty).toBe(7);

    const dbLines = await db
      .select()
      .from(cartLines)
      .where(eq(cartLines.cartId, cart.cartId));
    expect(dbLines.filter((l) => l.coArt === "A002")).toHaveLength(1);
  });
});
