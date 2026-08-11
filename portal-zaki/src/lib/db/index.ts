import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * The ONE place a Postgres connection is opened (CLAUDE.md boundary rule).
 * Nothing under `src/app/**` imports this directly — it goes through the
 * catalog / cart / orders / ingest data layers.
 *
 * Under NODE_ENV=test the client points at TEST_DATABASE_URL when set, so an
 * integration run never touches the app database.
 */
const connectionString =
  env.NODE_ENV === "test" && env.TEST_DATABASE_URL
    ? env.TEST_DATABASE_URL
    : env.DATABASE_URL;

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
