import { z } from "zod";

/**
 * The single validated entry point to `process.env` (see CLAUDE.md).
 *
 * Contract with the build order (blueprint §10): a variable becomes *required*
 * only from the step that consumes it. Everything else stays optional so an
 * earlier gate never fails on a variable a later step introduces. Extend the
 * schema step by step — never require them all up front.
 *
 * Required so far:
 *   - NODE_ENV (step 1)
 *   - DATABASE_URL (step 2)
 *   - SYNC_SHARED_SECRET (step 3)
 *   - INGEST_URL (step 4)
 *
 * The `PROFIT_SQL_*` credentials are validated lazily by `getProfitEnv()` — they
 * live only on the on-prem agent host, so the web tier must never require them.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().min(1),
  // Optional: integration tests point the db client here instead of DATABASE_URL.
  TEST_DATABASE_URL: z.string().min(1).optional(),
  // HMAC shared secret between the on-prem agent and /api/ingest.
  SYNC_SHARED_SECRET: z.string().min(1),
  // Where the agent POSTs signed batches. Present on both tiers via .env.
  INGEST_URL: z.string().min(1),
});

/** Thrown at import time when the environment is invalid — fail fast, never continue. */
export class EnvironmentValidationError extends Error {
  constructor(issues: string) {
    super(`Invalid environment variables:\n${issues}`);
    this.name = "EnvironmentValidationError";
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new EnvironmentValidationError(issues);
}

export const env = parsed.data;

/**
 * Agent-only credentials for the on-prem Profit Plus SQL Server. Validated lazily
 * — only when the sync agent actually connects — so the web tier never requires
 * them (blueprint §10 "Required by step": PROFIT_SQL_* belong to step 4's agent).
 */
const profitEnvSchema = z.object({
  PROFIT_SQL_HOST: z.string().min(1),
  PROFIT_SQL_USER: z.string().min(1),
  PROFIT_SQL_PASSWORD: z.string().min(1),
  PROFIT_SQL_DATABASE: z.string().min(1),
});

export type ProfitEnv = z.infer<typeof profitEnvSchema>;

export function getProfitEnv(): ProfitEnv {
  const result = profitEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new EnvironmentValidationError(issues);
  }
  return result.data;
}
