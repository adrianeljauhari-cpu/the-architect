"use server";

import { revalidatePath } from "next/cache";
import {
  activateClient,
  ensureAdmin,
  setProductHidden,
  setProductPhoto,
} from "@/lib/admin/server";
import { getSession } from "@/lib/auth";

/** Admin form actions. Each re-checks admin server-side before doing any work. */

async function requireAdminSession() {
  return ensureAdmin(await getSession());
}

export async function toggleHiddenAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const coArt = String(formData.get("coArt"));
  const hidden = formData.get("hidden") === "true";
  await setProductHidden(coArt, hidden);
  revalidatePath("/admin/productos");
  revalidatePath("/catalogo");
}

export async function setPhotoAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const coArt = String(formData.get("coArt"));
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();
  if (photoUrl.length > 0) {
    await setProductPhoto(coArt, photoUrl);
    revalidatePath("/admin/productos");
  }
}

export async function activateClientAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const coCli = String(formData.get("coCli"));
  await activateClient(coCli);
  revalidatePath("/admin/clientes");
}
