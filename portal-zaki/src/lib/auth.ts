import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { and, eq } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/index";
import {
  account,
  appUsers,
  customers,
  session,
  user,
  verification,
} from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * Auth for PORTAL-ZAKI (blueprint §8). Activation is OTP against the mirror:
 * a customer already exists in `customers`; only an email matching an ACTIVE
 * customer may receive a code. On the first successful verify a Better Auth
 * user is created and, just-in-time, an `app_users` row is provisioned linking
 * that identity to the customer's `co_cli`. `co_cli` is never a default password.
 */

/**
 * Test seam: in NODE_ENV=test the delivered OTP is captured here so the
 * integration test can drive the flow without a real mail transport. Real
 * delivery via Resend is wired in a later step.
 */
export const _testOtpMailbox = new Map<string, string>();

async function activeCustomerByEmail(email: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.email, email), eq(customers.inactivo, false)))
    .limit(1);
  return row ?? null;
}

/** Provision (idempotently) the app_user that links a Better Auth identity to a co_cli. */
async function provisionAppUser(
  authUserId: string,
  email: string,
): Promise<void> {
  const customer = await activeCustomerByEmail(email);
  if (!customer) return; // no matching active customer → nothing to link
  await db
    .insert(appUsers)
    .values({ authUserId, coCli: customer.coCli, role: "client" })
    .onConflictDoNothing({ target: appUsers.coCli });
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (created) => {
          await provisionAppUser(created.id, created.email);
        },
      },
    },
  },
  plugins: [
    emailOTP({
      // Only deliver a code to an email that belongs to an active customer.
      // Unknown emails get no code (and the UI shows a generic message), so no
      // account can ever be activated for them.
      sendVerificationOTP: async ({ email, otp }) => {
        const customer = await activeCustomerByEmail(email);
        if (!customer) return;
        if (env.NODE_ENV === "test") {
          _testOtpMailbox.set(email, otp);
        } else {
          // Real delivery (Resend) is wired in a later step.
          console.info(`[activation] OTP for ${email}: ${otp}`);
        }
      },
    }),
  ],
});

export type AppSession = {
  appUser: { id: string; co_cli: string | null; role: string };
  email: string;
};

/**
 * The single session accessor (CLAUDE.md). Returns the app user (with co_cli and
 * role) or null. Pass explicit headers in tests; defaults to the request headers.
 */
export async function getSession(
  reqHeaders?: Headers,
): Promise<AppSession | null> {
  const result = await auth.api.getSession({
    headers: reqHeaders ?? (await nextHeaders()),
  });
  if (!result) return null;

  const [row] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.authUserId, result.user.id))
    .limit(1);
  if (!row) return null;

  return {
    appUser: { id: row.id, co_cli: row.coCli, role: row.role },
    email: result.user.email,
  };
}

/** Page guard: an authenticated client, or redirect to /entrar. Enforced server-side. */
export async function requireClient(): Promise<AppSession> {
  const current = await getSession();
  if (!current) redirect("/entrar");
  return current;
}

/** Page guard: an admin, or redirect to /entrar. Between clients we 404, not 403 (§8). */
export async function requireAdmin(): Promise<AppSession> {
  const current = await getSession();
  if (current?.appUser.role !== "admin") redirect("/entrar");
  return current;
}
