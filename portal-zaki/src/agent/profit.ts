import sql from "mssql";
import { getProfitEnv } from "@/lib/env";
import type { IngestSource } from "@/lib/ingest/apply";

/**
 * READ-ONLY access to Profit Plus (blueprint §4/§14, .claude/rules/agent.md).
 * The agent NEVER writes to SQL Server. Reads are incremental by `row_id`
 * (rowversion): `WHERE row_id > @cursor ORDER BY row_id`. `char` codes are
 * space-padded in Profit, so every code is right-trimmed before it is emitted.
 *
 * SQL Server 2019 Enterprise (confirmed): standard TLS, no legacy workaround.
 * `trustServerCertificate` is used only for a self-signed cert on the LAN — the
 * server is never exposed to the internet.
 */

/** Thrown with a name so the orchestrator can exit non-zero on a failed connect. */
export class ProfitConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfitConnectionError";
  }
}

/** Right-trim Profit's space-padded `char` codes (co_art, co_cli, co_ofer, …). */
export function rtrim(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/\s+$/, "");
}

type Connector = (config: sql.config) => Promise<sql.ConnectionPool>;

export function profitConfig(): sql.config {
  const cred = getProfitEnv();
  return {
    server: cred.PROFIT_SQL_HOST,
    user: cred.PROFIT_SQL_USER,
    password: cred.PROFIT_SQL_PASSWORD,
    database: cred.PROFIT_SQL_DATABASE,
    options: { encrypt: true, trustServerCertificate: true },
    pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 8_000,
    requestTimeout: 30_000,
  };
}

/** Connect, wrapping any driver failure in a named error (testable without a server). */
export async function connectWith(
  connector: Connector,
): Promise<sql.ConnectionPool> {
  try {
    return await connector(profitConfig());
  } catch (err) {
    throw new ProfitConnectionError(
      `cannot connect to Profit SQL Server: ${(err as Error).message}`,
    );
  }
}

export function connectProfit(): Promise<sql.ConnectionPool> {
  return connectWith((config) => new sql.ConnectionPool(config).connect());
}

/** Query text per source. Cursor is compared as binary(8) from its 0x-hex form. */
const QUERIES: Record<IngestSource, string> = {
  art: `SELECT RTRIM(co_art) AS coArt, art_des AS artDes, RTRIM(co_lin) AS coLin,
          RTRIM(co_cat) AS coCat, RTRIM(co_subl) AS coSubl, RTRIM(co_prov) AS coProv,
          RTRIM(uni_venta) AS uniVenta, prec_vta1 AS precVta1, stock_act AS stockAct,
          stock_com AS stockCom, anulado, RTRIM(campo1) AS campo1,
          CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM art WHERE row_id > CONVERT(binary(8), @cursor, 1) ORDER BY row_id`,
  clientes: `SELECT RTRIM(co_cli) AS coCli, cli_des AS cliDes, RTRIM(rif) AS rif, email,
          telefonos, desc_glob AS descGlob, mont_cre AS montCre, saldo, plaz_pag AS plazPag,
          sincredito, RTRIM(co_seg) AS coSeg, RTRIM(tipo) AS tipo, cond_1pct AS cond1pct,
          inactivo, CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM clientes WHERE row_id > CONVERT(binary(8), @cursor, 1) ORDER BY row_id`,
  oferta: `SELECT RTRIM(co_ofer) AS coOfer, ofer_des AS oferDes, pos_ofer AS posOfer,
          fec_inic AS fecInic, fec_fin AS fecFin, RTRIM(co_seg_d) AS coSegD,
          RTRIM(co_seg_h) AS coSegH, RTRIM(co_cli_d) AS coCliD, RTRIM(co_cli_h) AS coCliH,
          CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM oferta WHERE row_id > CONVERT(binary(8), @cursor, 1) ORDER BY row_id`,
  offer_lines: `SELECT RTRIM(co_ofer) AS coOfer, RTRIM(co_art) AS coArt, porc_ofer AS porcOfer,
          CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM reng_ofer WHERE row_id > CONVERT(binary(8), @cursor, 1) ORDER BY row_id`,
  customer_offers: `SELECT RTRIM(co_ofer) AS coOfer, ofer_des AS oferDes, fec_inic AS fecInic,
          fec_fin AS fecFin, RTRIM(tipo_d) AS tipoD, RTRIM(tipo_h) AS tipoH,
          RTRIM(co_cli_d) AS coCliD, RTRIM(co_cli_h) AS coCliH,
          CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM oferta_cli WHERE row_id > CONVERT(binary(8), @cursor, 1) ORDER BY row_id`,
  customer_offer_lines: `SELECT RTRIM(co_ofer) AS coOfer, RTRIM(co_cli) AS coCli,
          porc_ofer AS porcOfer, CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM reng_cliofer WHERE row_id > CONVERT(binary(8), @cursor, 1) ORDER BY row_id`,
  exchange_rate: `SELECT TOP 1 1 AS id, fact_cam AS usdBs, fecha AS effectiveAt,
          CONVERT(varchar(18), row_id, 1) AS rowIdHex
        FROM tasas ORDER BY fecha DESC`,
};

export type ReadResult = { rows: Record<string, unknown>[]; cursor: string };

/**
 * Read one source incrementally. Strips the internal `rowIdHex` from exchange_rate
 * (its target table has no cursor column) and advances the returned cursor to the
 * newest `row_id` in the batch; an empty batch leaves the cursor unchanged.
 */
export async function readSource(
  pool: sql.ConnectionPool,
  source: IngestSource,
  cursor: string,
): Promise<ReadResult> {
  const result = await pool
    .request()
    .input("cursor", sql.VarChar, cursor)
    .query(QUERIES[source]);
  const rows = result.recordset as Record<string, unknown>[];

  if (rows.length === 0) return { rows: [], cursor };

  if (source === "exchange_rate") {
    return { rows: rows.map(({ rowIdHex, ...rest }) => rest), cursor };
  }

  const nextCursor = String(rows[rows.length - 1].rowIdHex ?? cursor);
  return { rows, cursor: nextCursor };
}
