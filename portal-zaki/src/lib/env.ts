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
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().min(1),
  // Optional: integration tests point the db client here instead of DATABASE_URL.
  TEST_DATABASE_URL: z.string().min(1).optional(),
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
