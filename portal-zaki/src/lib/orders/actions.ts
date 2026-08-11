"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { type SubmitResult, submitOrder } from "@/lib/orders/server";

/** Submit the open cart as a quotation. Identity, price and rate are all derived
 *  server-side; the client sends nothing but the intent to submit. */
export async function submitOrderAction(): Promise<SubmitResult> {
  const session = await getSession();
  if (!session?.appUser.co_cli) throw new Error("unauthorized");

  const result = await submitOrder(
    { id: session.appUser.id, co_cli: session.appUser.co_cli },
    { clientEmail: session.email },
  );
  revalidatePath("/carrito");
  revalidatePath("/cuenta");
  return result;
}
