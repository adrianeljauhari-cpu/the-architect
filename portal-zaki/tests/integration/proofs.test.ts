import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/index";
import { appUsers, paymentProofs } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import type { ProofNotification } from "@/lib/email";
import { registerPaymentProof } from "@/lib/payments/server";
import type { StoredFile, Uploader } from "@/lib/storage";

let owner: { id: string; co_cli: string };

function fakeUploader() {
  const state = { calls: 0 };
  const upload: Uploader = async ({ coCli, filename, stamp }) => {
    state.calls += 1;
    return {
      path: `${coCli}/${stamp}-${filename}`,
      // a signed URL carries a token — never a bare public URL
      signedUrl: `https://demo.supabase.co/storage/v1/object/sign/payment-proofs/${coCli}/${filename}?token=SIGNED123`,
    } satisfies StoredFile;
  };
  return { state, upload };
}

function mailbox() {
  const sent: ProofNotification[] = [];
  return { sent, sendEmail: async (p: ProofNotification) => void sent.push(p) };
}

const validInput = () => ({
  amount: "1500.50",
  currency: "BS",
  method: "transfer",
  reference: "REF-0001",
  file: {
    bytes: new Uint8Array([1, 2, 3, 4]),
    contentType: "image/png",
    filename: "comprobante.png",
  },
});

describe("payment proof capture", () => {
  beforeAll(async () => {
    await seed();
    await db
      .insert(appUsers)
      .values({ coCli: "0370", role: "client" })
      .onConflictDoNothing({
        target: appUsers.coCli,
      });
    const [row] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.coCli, "0370"))
      .limit(1);
    owner = { id: row.id, co_cli: "0370" };
  });
  beforeEach(async () => {
    await db.delete(paymentProofs).where(eq(paymentProofs.coCli, "0370"));
  });
  afterAll(async () => {
    await db.delete(paymentProofs).where(eq(paymentProofs.coCli, "0370"));
    await db.$client.end({ timeout: 5 });
  });

  it("stores the image, inserts one row, sends the email, and returns a signed URL", async () => {
    const storage = fakeUploader();
    const mail = mailbox();

    const result = await registerPaymentProof(owner, validInput(), {
      upload: storage.upload,
      sendEmail: mail.sendEmail,
      stamp: 1_700_000_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(storage.state.calls).toBe(1);
    expect(mail.sent).toHaveLength(1);
    expect(result.imageUrl).toContain("token="); // signed, not public

    const rows = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.coCli, "0370"));
    expect(rows).toHaveLength(1);
    expect(rows[0].imageUrl).toContain("token=");
    // emailed_at is sealed AFTER dispatch
    expect(rows[0].emailedAt).not.toBeNull();
  });

  it("rejects a proof missing a required field and writes nothing", async () => {
    const storage = fakeUploader();
    const mail = mailbox();
    const bad = { ...validInput(), reference: "" };

    const result = await registerPaymentProof(owner, bad, {
      upload: storage.upload,
      sendEmail: mail.sendEmail,
    });

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(storage.state.calls).toBe(0);
    expect(mail.sent).toHaveLength(0);

    const rows = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.coCli, "0370"));
    expect(rows).toHaveLength(0);
  });
});
