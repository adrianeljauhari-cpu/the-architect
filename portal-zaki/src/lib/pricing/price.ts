import { eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import {
  customerOfferLines,
  customerOffers,
  offerLines,
  offers,
  productCaps,
} from "@/lib/db/schema";
import { round2, round5 } from "@/lib/money";
import { lineNet } from "@/lib/pricing/cascade";
import { type PricingClient, resolveOfferPercents } from "@/lib/pricing/offers";

/**
 * The effective, server-side price for a (client, product, qty) — the contract
 * `02-tienda` consumes. Positions: p1/p3 from segment offers, p2 from oferta_cli,
 * p4 = the client's `desc_glob`; capped by `product_caps.porc_max`. Exposes
 * whether the global 1% applies (`customers.cond_1pct`), which the order applies
 * to the subtotal — never per line.
 */

export type PriceProduct = { coArt: string; precVta1: string | number };

export type PriceResult = {
  unitFrozen: string; // numeric(18,5)
  lineNet: string; // numeric(18,2)
  cascade: string; // "p1+p2+p3+p4" (Profit format)
  applies1pct: boolean;
  positions: [number, number, number, number];
};

/** Load the offer/cap inputs this product+client needs, then run the cascade. */
export async function price(
  client: PricingClient,
  product: PriceProduct,
  qty: string | number,
  at: Date = new Date(),
): Promise<PriceResult> {
  const [offerRows, lineRows, custOfferRows, custLineRows, capRows] =
    await Promise.all([
      db.select().from(offers),
      db.select().from(offerLines).where(eq(offerLines.coArt, product.coArt)),
      db.select().from(customerOffers),
      db
        .select()
        .from(customerOfferLines)
        .where(eq(customerOfferLines.coCli, client.coCli)),
      db
        .select()
        .from(productCaps)
        .where(eq(productCaps.coArt, product.coArt))
        .limit(1),
    ]);

  const porcMax = capRows[0] ? Number(capRows[0].porcMax) : undefined;

  const { p1, p2, p3 } = resolveOfferPercents({
    client,
    coArt: product.coArt,
    at,
    offers: offerRows,
    offerLines: lineRows,
    customerOffers: custOfferRows,
    customerOfferLines: custLineRows,
  });
  const p4 = Number(client.descGlob);
  const positions: [number, number, number, number] = [p1, p2, p3, p4];

  const { unit, net } = lineNet(product.precVta1, qty, positions, porcMax);

  return {
    unitFrozen: round5(unit),
    lineNet: round2(net),
    cascade: `${p1}+${p2}+${p3}+${p4}`,
    applies1pct: Boolean(client.cond1pct),
    positions,
  };
}
