import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/index";
import {
  customerOfferLines,
  customerOffers,
  customers,
  exchangeRate,
  offerLines,
  offers,
  productCaps,
  productOverrides,
  products,
} from "@/lib/db/schema";
import { round2 } from "@/lib/money";
import { unitNet } from "@/lib/pricing/cascade";
import { type PricingClient, resolveOfferPercents } from "@/lib/pricing/offers";

/**
 * Catalog reads, always scoped by the session's `co_cli` (CLAUDE.md: the scope is
 * a required parameter, not a "remember to filter"). Hidden products are omitted;
 * `disponible = max(0, stock_act - stock_com)`; out-of-stock is shown marked, not
 * hidden. Prices are computed server-side with the client's `desc_glob` + offers,
 * batched so a page of 60 products costs a handful of queries, not 60×.
 */

export const PAGE_SIZE = 60;

export type CatalogItem = {
  coArt: string;
  artDes: string;
  coLin: string | null;
  photoUrl: string | null;
  disponible: number;
  priceBs: string;
  priceUsd: string | null;
  cascade: string;
};

export type CatalogPage = {
  items: CatalogItem[];
  nextCursor: string | null;
  usdBs: string | null;
  rateAt: Date | null;
};

/** The pricing-relevant fields for a client, or null if the client is missing/inactive. */
export async function getPricingClient(
  coCli: string,
): Promise<PricingClient | null> {
  const [row] = await db
    .select({
      coCli: customers.coCli,
      coSeg: customers.coSeg,
      tipo: customers.tipo,
      descGlob: customers.descGlob,
      cond1pct: customers.cond1pct,
    })
    .from(customers)
    .where(and(eq(customers.coCli, coCli), eq(customers.inactivo, false)))
    .limit(1);
  return row ?? null;
}

type ProductRow = {
  coArt: string;
  artDes: string;
  coLin: string | null;
  precVta1: string;
  stockAct: string;
  stockCom: string;
  photoUrl: string | null;
};

/** Price a set of products for one client in a fixed number of queries. */
async function priceProducts(
  client: PricingClient,
  rows: ProductRow[],
  at: Date,
): Promise<{
  items: CatalogItem[];
  usdBs: string | null;
  rateAt: Date | null;
}> {
  const coArts = rows.map((r) => r.coArt);

  const [offerRows, lineRows, custOfferRows, custLineRows, capRows, rateRows] =
    await Promise.all([
      db.select().from(offers),
      coArts.length
        ? db.select().from(offerLines).where(inArray(offerLines.coArt, coArts))
        : Promise.resolve([]),
      db.select().from(customerOffers),
      db
        .select()
        .from(customerOfferLines)
        .where(eq(customerOfferLines.coCli, client.coCli)),
      coArts.length
        ? db
            .select()
            .from(productCaps)
            .where(inArray(productCaps.coArt, coArts))
        : Promise.resolve([]),
      db.select().from(exchangeRate).limit(1),
    ]);

  const capByArt = new Map(capRows.map((c) => [c.coArt, Number(c.porcMax)]));
  const rate = rateRows[0] ?? null;
  const p4 = Number(client.descGlob);

  const items = rows.map((row) => {
    const { p1, p2, p3 } = resolveOfferPercents({
      client,
      coArt: row.coArt,
      at,
      offers: offerRows,
      offerLines: lineRows,
      customerOffers: custOfferRows,
      customerOfferLines: custLineRows,
    });
    const positions: [number, number, number, number] = [p1, p2, p3, p4];
    const unit = unitNet(row.precVta1, positions, capByArt.get(row.coArt));
    const disponible = Math.max(0, Number(row.stockAct) - Number(row.stockCom));

    return {
      coArt: row.coArt,
      artDes: row.artDes,
      coLin: row.coLin,
      photoUrl: row.photoUrl,
      disponible,
      priceBs: round2(unit),
      priceUsd: rate ? round2(unit.div(rate.usdBs)) : null,
      cascade: `${p1}+${p2}+${p3}+${p4}`,
    } satisfies CatalogItem;
  });

  return {
    items,
    usdBs: rate?.usdBs ?? null,
    rateAt: rate?.effectiveAt ?? null,
  };
}

/** PLP: visible, non-anulado products for this client, text-searchable, cursor-paginated. */
export async function listCatalog(params: {
  coCli: string;
  search?: string;
  cursor?: string;
  limit?: number;
  at?: Date;
}): Promise<CatalogPage> {
  const client = await getPricingClient(params.coCli);
  if (!client)
    return { items: [], nextCursor: null, usdBs: null, rateAt: null };

  const limit = Math.min(params.limit ?? PAGE_SIZE, PAGE_SIZE);
  const conditions = [
    eq(products.anulado, false),
    or(isNull(productOverrides.isHidden), eq(productOverrides.isHidden, false)),
  ];
  if (params.cursor) conditions.push(gt(products.coArt, params.cursor));
  if (params.search?.trim()) {
    conditions.push(
      sql`to_tsvector('spanish', ${products.artDes}) @@ plainto_tsquery('spanish', ${params.search.trim()})`,
    );
  }

  const rows = await db
    .select({
      coArt: products.coArt,
      artDes: products.artDes,
      coLin: products.coLin,
      precVta1: products.precVta1,
      stockAct: products.stockAct,
      stockCom: products.stockCom,
      photoUrl: productOverrides.photoUrl,
    })
    .from(products)
    .leftJoin(productOverrides, eq(productOverrides.coArt, products.coArt))
    .where(and(...conditions))
    .orderBy(asc(products.coArt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const { items, usdBs, rateAt } = await priceProducts(
    client,
    pageRows,
    params.at ?? new Date(),
  );

  return {
    items,
    nextCursor: hasMore ? (pageRows.at(-1)?.coArt ?? null) : null,
    usdBs,
    rateAt,
  };
}

/** PDP: one product for this client, or null if hidden, anulado, or absent (→ 404). */
export async function getCatalogProduct(
  coCli: string,
  coArt: string,
  at: Date = new Date(),
): Promise<CatalogItem | null> {
  const client = await getPricingClient(coCli);
  if (!client) return null;

  const [row] = await db
    .select({
      coArt: products.coArt,
      artDes: products.artDes,
      coLin: products.coLin,
      precVta1: products.precVta1,
      stockAct: products.stockAct,
      stockCom: products.stockCom,
      photoUrl: productOverrides.photoUrl,
      isHidden: productOverrides.isHidden,
      anulado: products.anulado,
    })
    .from(products)
    .leftJoin(productOverrides, eq(productOverrides.coArt, products.coArt))
    .where(eq(products.coArt, coArt))
    .limit(1);

  if (!row || row.anulado || row.isHidden) return null;

  const { items } = await priceProducts(client, [row], at);
  return items[0] ?? null;
}
