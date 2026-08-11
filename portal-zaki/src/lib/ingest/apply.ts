import { eq, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/lib/db/index";
import {
  customerOfferLines,
  customerOffers,
  customers,
  exchangeRate,
  ingestEvents,
  offerLines,
  offers,
  products,
  syncState,
} from "@/lib/db/schema";

/**
 * The ONLY write path into the mirror tables (CLAUDE.md boundary rule). One
 * transaction per batch: dedup by `event_id`, upsert every row, advance the
 * per-source cursor, record the event. A replayed `event_id` is a no-op.
 */

export const INGEST_SOURCES = [
  "art",
  "clientes",
  "oferta",
  "offer_lines",
  "customer_offers",
  "customer_offer_lines",
  "exchange_rate",
] as const;

export type IngestSource = (typeof INGEST_SOURCES)[number];

/* --- coercers: the agent may send numbers or ISO strings; the mirror stores
   numeric-as-string and timestamptz. Normalize here. --- */
const numeric = z.union([z.number(), z.string()]).transform((v) => String(v));
const intField = z.union([z.number(), z.string()]).transform((v) => Number(v));
const dateField = z.union([z.string(), z.date()]).transform((v) => new Date(v));

const rowSchemas = {
  art: z.object({
    coArt: z.string(),
    artDes: z.string(),
    coLin: z.string().nullish(),
    coCat: z.string().nullish(),
    coSubl: z.string().nullish(),
    coProv: z.string().nullish(),
    uniVenta: z.string().nullish(),
    precVta1: numeric,
    stockAct: numeric,
    stockCom: numeric,
    anulado: z.boolean().default(false),
    campo1: z.string().nullish(),
    rowIdHex: z.string(),
  }),
  clientes: z.object({
    coCli: z.string(),
    cliDes: z.string(),
    rif: z.string().nullish(),
    email: z.string().nullish(),
    telefonos: z.string().nullish(),
    descGlob: numeric,
    montCre: numeric,
    saldo: numeric,
    plazPag: intField,
    sincredito: z.boolean().default(false),
    coSeg: z.string().nullish(),
    tipo: z.string().nullish(),
    cond1pct: z.boolean().default(false),
    inactivo: z.boolean().default(false),
    rowIdHex: z.string(),
  }),
  oferta: z.object({
    coOfer: z.string(),
    oferDes: z.string(),
    posOfer: intField,
    fecInic: dateField,
    fecFin: dateField,
    coSegD: z.string().nullish(),
    coSegH: z.string().nullish(),
    coCliD: z.string().nullish(),
    coCliH: z.string().nullish(),
  }),
  offer_lines: z.object({
    coOfer: z.string(),
    coArt: z.string(),
    porcOfer: numeric,
  }),
  customer_offers: z.object({
    coOfer: z.string(),
    oferDes: z.string(),
    fecInic: dateField,
    fecFin: dateField,
    tipoD: z.string().nullish(),
    tipoH: z.string().nullish(),
    coCliD: z.string().nullish(),
    coCliH: z.string().nullish(),
  }),
  customer_offer_lines: z.object({
    coOfer: z.string(),
    coCli: z.string(),
    porcOfer: numeric,
  }),
  exchange_rate: z.object({
    id: intField.default(1),
    usdBs: numeric,
    effectiveAt: dateField,
  }),
} satisfies Record<IngestSource, z.ZodType>;

type SourceConfig = { table: PgTable; conflict: string[] };

const sourceConfig: Record<IngestSource, SourceConfig> = {
  art: { table: products, conflict: ["coArt"] },
  clientes: { table: customers, conflict: ["coCli"] },
  oferta: { table: offers, conflict: ["coOfer"] },
  offer_lines: { table: offerLines, conflict: ["coOfer", "coArt"] },
  customer_offers: { table: customerOffers, conflict: ["coOfer"] },
  customer_offer_lines: {
    table: customerOfferLines,
    conflict: ["coOfer", "coCli"],
  },
  exchange_rate: { table: exchangeRate, conflict: ["id"] },
};

/** Build an ON CONFLICT ... DO UPDATE SET clause that copies every non-key column from EXCLUDED. */
function excludedSet(table: PgTable, keys: string[], conflict: string[]) {
  const cols = table as unknown as Record<string, PgColumn>;
  const set: Record<string, ReturnType<typeof sql>> = {};
  for (const key of keys) {
    if (conflict.includes(key)) continue;
    set[key] = sql`excluded.${sql.identifier(cols[key].name)}`;
  }
  return set;
}

export type ApplyResult = { rowsApplied: number; deduped: boolean };

/**
 * Apply one ingest batch. Throws `z.ZodError` when a row is malformed (the route
 * maps that to 400 and the transaction rolls back, so nothing is written).
 */
export async function apply(
  source: IngestSource,
  rows: unknown[],
  cursor: string,
  eventId: string,
): Promise<ApplyResult> {
  const cfg = sourceConfig[source];
  const schema = rowSchemas[source];

  return db.transaction(async (tx) => {
    const seen = await tx
      .select({ id: ingestEvents.eventId })
      .from(ingestEvents)
      .where(eq(ingestEvents.eventId, eventId))
      .limit(1);
    if (seen.length > 0) {
      return { rowsApplied: 0, deduped: true };
    }

    const now = new Date();
    const values = rows.map((raw) => ({ ...schema.parse(raw), syncedAt: now }));

    if (values.length > 0) {
      const keys = new Set<string>();
      for (const value of values) {
        for (const key of Object.keys(value)) keys.add(key);
      }
      await tx
        .insert(cfg.table)
        .values(values)
        .onConflictDoUpdate({
          target: cfg.conflict.map(
            (k) => (cfg.table as unknown as Record<string, PgColumn>)[k],
          ),
          set: excludedSet(cfg.table, [...keys], cfg.conflict),
        });
    }

    await tx
      .insert(syncState)
      .values({
        source,
        lastRowIdHex: cursor,
        lastRunAt: now,
        lastStatus: "ok",
      })
      .onConflictDoUpdate({
        target: syncState.source,
        set: { lastRowIdHex: cursor, lastRunAt: now, lastStatus: "ok" },
      });

    await tx
      .insert(ingestEvents)
      .values({ eventId, source, rowsApplied: values.length });

    return { rowsApplied: values.length, deduped: false };
  });
}
