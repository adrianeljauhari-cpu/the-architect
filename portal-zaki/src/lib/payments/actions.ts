"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { type ProofResult, registerPaymentProof } from "@/lib/payments/server";

/** Server action for the payment-proof form. Reads the multipart FormData,
 *  derives identity from the session, and delegates to the core. */
export async function registerProofAction(
  formData: FormData,
): Promise<ProofResult> {
  const session = await getSession();
  if (!session?.appUser.co_cli) throw new Error("unauthorized");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, reason: "invalid" };
  const bytes = new Uint8Array(await file.arrayBuffer());

  const note = formData.get("note");
  const result = await registerPaymentProof(
    { id: session.appUser.id, co_cli: session.appUser.co_cli },
    {
      amount: String(formData.get("amount") ?? ""),
      currency: String(formData.get("currency") ?? ""),
      method: String(formData.get("method") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      note: typeof note === "string" && note.length > 0 ? note : undefined,
      file: {
        bytes,
        contentType: file.type || "application/octet-stream",
        filename: file.name || "comprobante",
      },
    },
  );

  revalidatePath("/cuenta");
  return result;
}
