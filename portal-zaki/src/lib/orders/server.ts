import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { CartOwner } from "@/lib/cart/server";
import { getPricingClient } from "@/lib/catalog/queries";
import { db } from "@/lib/db/index";
import {
  cartLines,
  carts,
  exchangeRate,
  orderLines,
  orders,
  productOverrides,
  products,
} from "@/lib/db/schema";
import { type QuotationSender, sendQuotationEmail } from "@/lib/email";
import { round2, toBig } from "@/lib/money";
import { price } from "@/lib/pricing/price";

/**
 * Turn an open cart into an immutable quotation (blueprint §9 step 9). Each line
 * is recomputed and FROZEN (unit_frozen, cascade, line_net); the rate is frozen
 * to `usd_bs_used`; the 1% global is applied to the subtotal only when the client
 * is cond_1pct. A line pointing at a hidden or out-of-stock product creates no
 * order and reports the offenders. Writes are one transaction; email is sent
 * after commit and the cart is marked submitted.
 */

export type SubmitResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; reason: "empty" | "no_client"; offending?: undefined }
  | { ok: false; reason: "unavailable"; offending: string[] };

export type SubmitDeps = {
  sendEmail?: QuotationSender;
  clientEmail?: string | null;
  at?: Date;
};

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PZ-${stamp}-${rand}`;
}

export async function submitOrder(
  owner: CartOwner,
  deps: SubmitDeps = {},
): Promise<SubmitResult> {
  if (!owner.co_cli) return { ok: false, reason: "no_client" };
  const client = await getPricingClient(owner.co_cli);
  if (!client) return { ok: false, reason: "no_client" };
  const coCli = owner.co_cli;
  const at = deps.at ?? new Date();

  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.appUserId, owner.id), eq(carts.status, "open")))
    .limit(1);
  if (!cart) return { ok: false, reason: "empty" };

  const rawLines = await db
    .select({ coArt: cartLines.coArt, qty: cartLines.qty })
    .from(cartLines)
    .where(eq(cartLines.cartId, cart.id));
  if (rawLines.length === 0) return { ok: false, reason: "empty" };

  const offending: string[] = [];
  const plans: {
    coArt: string;
    artDes: string;
    qty: number;
    precVta1: string;
    cascade: string;
    unitFrozen: string;
    lineNet: string;
  }[] = [];

  for (const raw of rawLines) {
    const [row] = await db
      .select({
        precVta1: products.precVta1,
        artDes: products.artDes,
        stockAct: products.stockAct,
        stockCom: products.stockCom,
        anulado: products.anulado,
        isHidden: productOverrides.isHidden,
      })
      .from(products)
      .leftJoin(productOverrides, eq(productOverrides.coArt, products.coArt))
      .where(eq(products.coArt, raw.coArt))
      .limit(1);

    const qty = Number(raw.qty);
    const disponible = row
      ? Math.max(0, Number(row.stockAct) - Number(row.stockCom))
      : 0;
    if (!row || row.anulado || row.isHidden || qty > disponible) {
      offending.push(raw.coArt);
      continue;
    }

    const priced = await price(
      client,
      { coArt: raw.coArt, precVta1: row.precVta1 },
      qty,
      at,
    );
    plans.push({
      coArt: raw.coArt,
      artDes: row.artDes,
      qty,
      precVta1: row.precVta1,
      cascade: priced.cascade,
      unitFrozen: priced.unitFrozen,
      lineNet: priced.lineNet,
    });
  }

  if (offending.length > 0)
    return { ok: false, reason: "unavailable", offending };

  const [rate] = await db.select().from(exchangeRate).limit(1);
  const usdBsUsed = rate?.usdBs ?? "0";

  let subtotal = toBig(0);
  for (const plan of plans) subtotal = subtotal.plus(toBig(plan.lineNet));
  const applied1pct = Boolean(client.cond1pct);
  const total = applied1pct ? subtotal.times("0.99") : subtotal;
  const orderNumber = generateOrderNumber();

  const orderId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        orderNumber,
        appUserId: owner.id,
        coCli,
        usdBsUsed,
        applied1pct,
        subtotal: round2(subtotal),
        total: round2(total),
        status: "submitted",
      })
      .returning({ id: orders.id });

    await tx.insert(orderLines).values(
      plans.map((plan) => ({
        orderId: created.id,
        coArt: plan.coArt,
        artDes: plan.artDes,
        qty: String(plan.qty),
        precVta1: plan.precVta1,
        cascade: plan.cascade,
        unitFrozen: plan.unitFrozen,
        lineNet: plan.lineNet,
      })),
    );

    await tx
      .update(carts)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(carts.id, cart.id));

    return created.id;
  });

  // Email is a notification, not the source of truth: the order is already
  // committed, so a delivery failure (e.g. no Resend key in dev) must not lose it.
  const sendEmail = deps.sendEmail ?? sendQuotationEmail;
  try {
    await sendEmail({
      orderNumber,
      coCli,
      clientEmail: deps.clientEmail ?? null,
      usdBs: usdBsUsed,
      subtotal: round2(subtotal),
      total: round2(total),
      applied1pct,
      lines: plans.map((plan) => ({
        coArt: plan.coArt,
        artDes: plan.artDes,
        qty: plan.qty,
        unitFrozen: plan.unitFrozen,
        lineNet: plan.lineNet,
      })),
    });
  } catch (err) {
    console.error(`quotation email failed for ${orderNumber}:`, err);
  }

  return { ok: true, orderId, orderNumber };
}
