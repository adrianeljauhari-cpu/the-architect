// Standalone tsx entrypoint (Windows Task Scheduler runs `pnpm agent:once`).
// dotenv FIRST so env is loaded before any validation.
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  connectProfit,
  ProfitConnectionError,
  readSource,
} from "@/agent/profit";
import { buildBatch, pushBatch } from "@/agent/push";
import { INGEST_SOURCES, type IngestSource } from "@/lib/ingest/apply";

const ZERO_CURSOR = "0x0000000000000000";

export interface CursorStore {
  get(source: IngestSource): Promise<string>;
  set(source: IngestSource, cursor: string): Promise<void>;
}

export interface Reader {
  read(
    source: IngestSource,
    cursor: string,
  ): Promise<{ rows: unknown[]; cursor: string }>;
}

export interface Pusher {
  push(source: IngestSource, rows: unknown[], cursor: string): Promise<void>;
}

export interface SyncDeps {
  store: CursorStore;
  reader: Reader;
  pusher: Pusher;
  sources?: readonly IngestSource[];
}

/**
 * One sync cycle across the sources. For each: read incrementally from the last
 * cursor, push the batch, and advance the local cursor ONLY after the push is
 * accepted — so a failed push is retried from the same point next cycle.
 */
export async function runOnce(deps: SyncDeps): Promise<void> {
  const sources = deps.sources ?? INGEST_SOURCES;
  for (const source of sources) {
    const cursor = await deps.store.get(source);
    const { rows, cursor: next } = await deps.reader.read(source, cursor);
    if (rows.length === 0) continue;
    await deps.pusher.push(source, rows, next);
    await deps.store.set(source, next);
  }
}

/** Cursor persistence across `--once` runs — a JSON file on the agent host. */
export function fileCursorStore(
  path: string = process.env.AGENT_CURSOR_FILE ?? ".agent-cursors.json",
): CursorStore {
  const readAll = (): Record<string, string> =>
    existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  return {
    async get(source) {
      return readAll()[source] ?? ZERO_CURSOR;
    },
    async set(source, cursor) {
      const all = readAll();
      all[source] = cursor;
      writeFileSync(path, JSON.stringify(all, null, 2));
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const store = fileCursorStore();

  let pool: Awaited<ReturnType<typeof connectProfit>>;
  try {
    pool = await connectProfit();
  } catch (err) {
    const message =
      err instanceof ProfitConnectionError ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }

  const reader: Reader = {
    read: (source, cursor) => readSource(pool, source, cursor),
  };
  const pusher: Pusher = {
    push: async (source, rows, cursor) => {
      await pushBatch(buildBatch(source, rows, cursor));
    },
  };

  try {
    do {
      await runOnce({ store, reader, pusher });
      if (!once) await sleep(60_000);
    } while (!once);
  } finally {
    await pool.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
