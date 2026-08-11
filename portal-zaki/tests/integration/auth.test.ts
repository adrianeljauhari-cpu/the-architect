import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { _testOtpMailbox, auth, getSession } from "@/lib/auth";
import { db } from "@/lib/db/index";
import { appUsers, user } from "@/lib/db/schema";

const KNOWN = "contado0002@example.com"; // seeded active customer 0002
const UNKNOWN = "nobody-not-a-customer@example.com";

async function cleanup() {
  await db.delete(appUsers).where(eq(appUsers.coCli, "0002"));
  await db.delete(user).where(inArray(user.email, [KNOWN, UNKNOWN]));
  _testOtpMailbox.clear();
}

async function activate(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const otp = _testOtpMailbox.get(email);
  if (!otp) return null;
  await auth.api.signInEmailOTP({ body: { email, otp } });
  return otp;
}

describe("auth activation from the mirror", () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await db.$client.end({ timeout: 5 });
  });

  it("returns no session for an anonymous request (protected pages redirect)", async () => {
    const session = await getSession(new Headers());
    expect(session).toBeNull();
  });

  it("creates no user and delivers no code for an email not in customers", async () => {
    await auth.api.sendVerificationOTP({
      body: { email: UNKNOWN, type: "sign-in" },
    });

    expect(_testOtpMailbox.has(UNKNOWN)).toBe(false);
    const users = await db.select().from(user).where(eq(user.email, UNKNOWN));
    expect(users).toHaveLength(0);
  });

  it("provisions exactly one app_user linked to the co_cli on valid OTP", async () => {
    const otp = await activate(KNOWN);
    expect(otp).toBeTruthy();

    const rows = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.coCli, "0002"));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("client");
    expect(rows[0].authUserId).toBeTruthy();
  });

  it("leaves exactly one app_user when the activation happens twice", async () => {
    await activate(KNOWN);
    await activate(KNOWN);

    const rows = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.coCli, "0002"));
    expect(rows).toHaveLength(1);
  });
});
