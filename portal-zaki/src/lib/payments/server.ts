import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/index";
import { paymentProofs } from "@/lib/db/schema";
import { type ProofSender, sendProofEmail } from "@/lib/email";
import { type Uploader, uploadProof } from "@/lib/storage";

/**
 * Register a client payment proof (blueprint §9 step 10). Validate → upload the
 * image (signed URL) → insert one `payment_proofs` row → send the notification →
 * seal `emailed_at` AFTER the email is dispatched. A missing required field
 * writes nothing. Storage and email are injectable for tests.
 */

export type ProofOwner = { id: string; co_cli: string | null };

export type ProofFile = {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
};

export type ProofInput = {
  amount: string | number;
  currency: string;
  method: string;
  reference: string;
  note?: string;
  file: ProofFile;
};

export type ProofDeps = {
  upload?: Uploader;
  sendEmail?: ProofSender;
  stamp?: number;
};

export type ProofResult =
  | { ok: true; id: string; imageUrl: string }
  | { ok: false; reason: "invalid" };

const proofSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.enum(["BS", "USD"]),
  method: z.enum(["transfer", "pago_movil", "deposit"]),
  reference: z.string().min(1),
  note: z.string().optional(),
});

export async function registerPaymentProof(
  owner: ProofOwner,
  input: ProofInput,
  deps: ProofDeps = {},
): Promise<ProofResult> {
  if (!owner.co_cli) return { ok: false, reason: "invalid" };
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!input.file || input.file.bytes.length === 0)
    return { ok: false, reason: "invalid" };

  const upload = deps.upload ?? uploadProof;
  const stored = await upload({
    bytes: input.file.bytes,
    contentType: input.file.contentType,
    coCli: owner.co_cli,
    filename: input.file.filename,
    stamp: deps.stamp ?? Date.now(),
  });

  const [row] = await db
    .insert(paymentProofs)
    .values({
      appUserId: owner.id,
      coCli: owner.co_cli,
      amount: String(parsed.data.amount),
      currency: parsed.data.currency,
      method: parsed.data.method,
      reference: parsed.data.reference,
      imageUrl: stored.signedUrl,
      note: parsed.data.note ?? null,
    })
    .returning({ id: paymentProofs.id });

  const sendEmail = deps.sendEmail ?? sendProofEmail;
  await sendEmail({
    coCli: owner.co_cli,
    amount: String(parsed.data.amount),
    currency: parsed.data.currency,
    method: parsed.data.method,
    reference: parsed.data.reference,
    imageUrl: stored.signedUrl,
  });

  // seal emailed_at only AFTER the email is dispatched (acceptance order)
  await db
    .update(paymentProofs)
    .set({ emailedAt: new Date() })
    .where(eq(paymentProofs.id, row.id));

  return { ok: true, id: row.id, imageUrl: stored.signedUrl };
}
