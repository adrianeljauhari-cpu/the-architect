import { and, eq } from "drizzle-orm";
import { getPricingClient } from "@/lib/catalog/queries";
import { db } from "@/lib/db/index";
import { cartLines, carts, products } from "@/lib/db/schema";
import { round2, toBig } from "@/lib/money";
import { price } from "@/lib/pricing/price";

/**
 * Server-authoritative cart (blueprint §8/§9 step 8). Lines store ONLY co_art +
 * qty; price and totals are recomputed server-side on every read with the
 * client's own `desc_glob` and offers — a price sent by the client is never
 * trusted. Quantities are capped at `disponible`; the same product added twice
 * keeps one line (unique cart_id, co_art) and sums the quantity.
 */

export type CartOwner = { id: string; co_cli: string | null };

export type CartLineView = {
  coArt: string;
  artDes: string;
  qty: number;
  unitFrozen: string;
  lineNet: string;
  disponible: number;
};

export type CartView = {
  cartId: string;
  lines: CartLineView[];
  subtotal: string;
  applied1pct: boolean;
  total: string;
  usdBs: string | null;
};

export type CartMutation =
  | { ok: true }
  | {
      ok: false;
      reason: "not_found" | "unavailable" | "bad_qty" | "oversell";
      available?: number;
    };

type Stock = {
  precVta1: string;
  artDes: string;
  disponible: number;
  vendible: boolean;
};

async function stockFor(coArt: string): Promise<Stock | null> {
  const [row] = await db
    .select({
      precVta1: products.precVta1,
      artDes: products.artDes,
      stockAct: products.stockAct,
      stockCom: products.stockCom,
      anulado: products.anulado,
    })
    .from(products)
    .where(eq(products.coArt, coArt))
    .limit(1);
  if (!row) return null;
  return {
    precVta1: row.precVta1,
    artDes: row.artDes,
    disponible: Math.max(0, Number(row.stockAct) - Number(row.stockCom)),
    vendible: !row.anulado,
  };
}

/** The single open cart for a user, created on first use. */
export async function getOrCreateOpenCart(appUserId: string): Promise<string> {
  const [existing] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.appUserId, appUserId), eq(carts.status, "open")))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(carts)
    .values({ appUserId, status: "open" })
    .returning({ id: carts.id });
  return created.id;
}

async function currentQty(cartId: string, coArt: string): Promise<number> {
  const [line] = await db
    .select({ qty: cartLines.qty })
    .from(cartLines)
    .where(and(eq(cartLines.cartId, cartId), eq(cartLines.coArt, coArt)))
    .limit(1);
  return line ? Number(line.qty) : 0;
}

/** Add `qty` of a product, summing into the existing line. Rejects oversell. */
export async function addToCart(
  owner: CartOwner,
  coArt: string,
  qty: number,
): Promise<CartMutation> {
  if (!Number.isFinite(qty) || qty <= 0)
    return { ok: false, reason: "bad_qty" };

  const stock = await stockFor(coArt);
  if (!stock) return { ok: false, reason: "not_found" };
  if (!stock.vendible) return { ok: false, reason: "unavailable" };

  const cartId = await getOrCreateOpenCart(owner.id);
  const desired = (await currentQty(cartId, coArt)) + qty;
  if (desired > stock.disponible) {
    return { ok: false, reason: "oversell", available: stock.disponible };
  }

  await db
    .insert(cartLines)
    .values({ cartId, coArt, qty: String(desired) })
    .onConflictDoUpdate({
      target: [cartLines.cartId, cartLines.coArt],
      set: { qty: String(desired) },
    });
  return { ok: true };
}

/** Set an absolute quantity (0 removes the line). Rejects oversell. */
export async function updateCartLine(
  owner: CartOwner,
  coArt: string,
  qty: number,
): Promise<CartMutation> {
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, reason: "bad_qty" };

  const cartId = await getOrCreateOpenCart(owner.id);
  if (qty === 0) {
    await removeCartLine(owner, coArt);
    return { ok: true };
  }

  const stock = await stockFor(coArt);
  if (!stock) return { ok: false, reason: "not_found" };
  if (qty > stock.disponible) {
    return { ok: false, reason: "oversell", available: stock.disponible };
  }

  await db
    .insert(cartLines)
    .values({ cartId, coArt, qty: String(qty) })
    .onConflictDoUpdate({
      target: [cartLines.cartId, cartLines.coArt],
      set: { qty: String(qty) },
    });
  return { ok: true };
}

export async function removeCartLine(
  owner: CartOwner,
  coArt: string,
): Promise<void> {
  const cartId = await getOrCreateOpenCart(owner.id);
  await db
    .delete(cartLines)
    .where(and(eq(cartLines.cartId, cartId), eq(cartLines.coArt, coArt)));
}

/** Read the cart, recomputing every price server-side. The 1% global is applied
 *  to the subtotal only when the client is cond_1pct — never per line. */
export async function getCart(
  owner: CartOwner,
  at: Date = new Date(),
): Promise<CartView> {
  const cartId = await getOrCreateOpenCart(owner.id);
  const rawLines = await db
    .select({ coArt: cartLines.coArt, qty: cartLines.qty })
    .from(cartLines)
    .where(eq(cartLines.cartId, cartId));

  const client = owner.co_cli ? await getPricingClient(owner.co_cli) : null;

  const lines: CartLineView[] = [];
  let subtotal = toBig(0);

  if (client) {
    for (const raw of rawLines) {
      const stock = await stockFor(raw.coArt);
      if (!stock) continue;
      const qty = Number(raw.qty);
      const priced = await price(
        client,
        { coArt: raw.coArt, precVta1: stock.precVta1 },
        qty,
        at,
      );
      subtotal = subtotal.plus(toBig(priced.lineNet));
      lines.push({
        coArt: raw.coArt,
        artDes: stock.artDes,
        qty,
        unitFrozen: priced.unitFrozen,
        lineNet: priced.lineNet,
        disponible: stock.disponible,
      });
    }
  }

  const applied1pct = Boolean(client?.cond1pct);
  const total = applied1pct ? subtotal.times("0.99") : subtotal;

  return {
    cartId,
    lines,
    subtotal: round2(subtotal),
    applied1pct,
    total: round2(total),
    usdBs: null,
  };
}
