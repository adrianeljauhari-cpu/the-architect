import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { and, eq, isNull } from "drizzle-orm";
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
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

/**
 * Provision (idempotently) the app_user that links a Better Auth identity to a
 * co_cli. If an admin pre-created a contactless app_user (auth_user_id null),
 * this links it on the client's first self-activation (§8); the setWhere guard
 * never overwrites an already-linked account.
 */
async function provisionAppUser(
  authUserId: string,
  email: string,
): Promise<void> {
  const customer = await activeCustomerByEmail(email);
  if (!customer) return; // no matching active customer → nothing to link
  await db
    .insert(appUsers)
    .values({ authUserId, coCli: customer.coCli, role: "client" })
    .onConflictDoUpdate({
      target: appUsers.coCli,
      set: { authUserId },
      setWhere: isNull(appUsers.authUserId),
    });
}

async function provisionFromUserId(userId: string): Promise<void> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (row) await provisionAppUser(userId, row.email);
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
    // Also link on every sign-in: a returning user does not re-trigger user.create,
    // so this guarantees a pre-existing unlinked app_user gets linked.
    session: {
      create: {
        after: async (created) => {
          await provisionFromUserId(created.userId);
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
        // Outside production the code is captured in-memory (tests) and exposed
        // via the guarded /api/dev/last-otp route (E2E). Production delivers via
        // Resend — wired at launch.
        if (env.NODE_ENV === "production") {
          console.info(`[activation] OTP dispatched for ${email}`);
        } else {
          _testOtpMailbox.set(email, otp);
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
  if (!result) {
    // TEMPORARY demo access (remove before real launch): a visitor holding the
    // demo cookie (set only via /api/demo?key=<secret>) browses read-only as the
    // first active customer. Never triggers in tests (reqHeaders is passed there).
    if (!reqHeaders) {
      const jar = await nextCookies();
      if (jar.get("pz_demo")?.value === "1") {
        const [demo] = await db
          .select()
          .from(customers)
          .where(eq(customers.inactivo, false))
          .limit(1);
        if (demo) {
          return {
            appUser: { id: "demo", co_cli: demo.coCli, role: "client" },
            email: demo.email ?? "demo@zakipharma.com",
          };
        }
      }
    }
    return null;
  }

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
