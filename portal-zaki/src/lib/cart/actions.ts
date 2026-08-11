"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  addToCart,
  type CartMutation,
  type CartOwner,
  removeCartLine,
  updateCartLine,
} from "@/lib/cart/server";

/** Server actions for cart mutations. Every one re-derives the owner from the
 *  session server-side — the client never supplies identity, price or totals. */

async function requireOwner(): Promise<CartOwner> {
  const session = await getSession();
  if (!session?.appUser.co_cli) throw new Error("unauthorized");
  return { id: session.appUser.id, co_cli: session.appUser.co_cli };
}

export async function addToCartAction(
  coArt: string,
  qty: number,
): Promise<CartMutation> {
  const result = await addToCart(await requireOwner(), coArt, qty);
  revalidatePath("/carrito");
  return result;
}

export async function setCartQtyAction(
  coArt: string,
  qty: number,
): Promise<CartMutation> {
  const result = await updateCartLine(await requireOwner(), coArt, qty);
  revalidatePath("/carrito");
  return result;
}

export async function removeCartLineAction(coArt: string): Promise<void> {
  await removeCartLine(await requireOwner(), coArt);
  revalidatePath("/carrito");
}
