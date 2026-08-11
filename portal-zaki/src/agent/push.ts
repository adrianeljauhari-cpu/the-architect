import crypto, { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import type { IngestSource } from "@/lib/ingest/apply";

/**
 * Builds and pushes a signed batch to /api/ingest. No React, no components —
 * the agent shares only db/schema, env and money (CLAUDE.md boundary).
 */

export type Batch = {
  event_id: string;
  source: IngestSource;
  rows: unknown[];
  cursor: string;
};

export function buildBatch(
  source: IngestSource,
  rows: unknown[],
  cursor: string,
  eventId: string = randomUUID(),
): Batch {
  return { event_id: eventId, source, rows, cursor };
}

/** `sha256=<hex>` HMAC of the exact bytes that will be sent as the body. */
export function signBody(body: string): string {
  const hmac = crypto
    .createHmac("sha256", env.SYNC_SHARED_SECRET)
    .update(body)
    .digest("hex");
  return `sha256=${hmac}`;
}

export type FetchLike = typeof fetch;

/**
 * POST the batch. The body is serialized ONCE and both signed and sent, so the
 * signature always matches the received bytes. Throws on a non-2xx / not-ok reply.
 */
export async function pushBatch(
  batch: Batch,
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const body = JSON.stringify(batch);
  const res = await fetchImpl(env.INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature": signBody(body),
    },
    body,
  });

  const json = (await res.json()) as { ok?: boolean };
  if (!res.ok || json.ok !== true) {
    throw new Error(
      `ingest rejected batch ${batch.event_id} with status ${res.status}`,
    );
  }
  return json;
}
