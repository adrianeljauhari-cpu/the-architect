import { sql } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { products } from "@/lib/db/schema";

/**
 * Observability: mirror-freshness health and data-integrity reconciliation
 * (blueprint §9 step 13 / §16). Health is `ok` while the newest mirror row is
 * within the freshness window, `degraded` beyond it. Reconciliation asserts the
 * two invariants of the money path: every order has lines, and no frozen line
 * discount exceeds its product's `porc_max`.
 */

export const MIRROR_FRESHNESS_MS = 10 * 60 * 1000; // 10 minutes (§16 alert threshold)

export type Health = {
  status: "ok" | "degraded";
  latestSyncedAt: Date | null;
  ageSeconds: number | null;
};

export async function checkHealth(now: Date = new Date()): Promise<Health> {
  const [row] = await db
    .select({ latest: sql<string | null>`max(${products.syncedAt})` })
    .from(products);

  const latest = row?.latest ? new Date(row.latest) : null;
  if (!latest)
    return { status: "degraded", latestSyncedAt: null, ageSeconds: null };

  const ageMs = now.getTime() - latest.getTime();
  return {
    status: ageMs <= MIRROR_FRESHNESS_MS ? "ok" : "degraded",
    latestSyncedAt: latest,
    ageSeconds: Math.round(ageMs / 1000),
  };
}

export type Reconciliation = {
  ordersWithoutLines: number;
  linesOverCap: number;
};

export async function reconcile(): Promise<Reconciliation> {
  const withoutLines = await db.execute(sql`
    SELECT count(*)::int AS n
    FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM order_lines ol WHERE ol.order_id = o.id)
  `);

  // Total applied discount per frozen line = 1 - unit_frozen / prec_vta1.
  // A clean dataset has none exceeding the product's porc_max (tiny epsilon for rounding).
  const overCap = await db.execute(sql`
    SELECT count(*)::int AS n
    FROM order_lines ol
    JOIN product_caps pc ON pc.co_art = ol.co_art
    WHERE (1 - ol.unit_frozen / ol.prec_vta1) * 100 > pc.porc_max + 0.001
  `);

  return {
    ordersWithoutLines: Number(withoutLines[0]?.n ?? 0),
    linesOverCap: Number(overCap[0]?.n ?? 0),
  };
}
