import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { AppSession } from "@/lib/auth";
import { db } from "@/lib/db/index";
import {
  appUsers,
  customers,
  productOverrides,
  products,
  syncState,
} from "@/lib/db/schema";

/**
 * Admin operations (blueprint §9 step 12), all protected server-side. Between
 * clients the app returns 404, not 403 — a non-admin must not learn /admin exists.
 */

/** 404 for anyone who is not an admin (used by the (admin) layout and actions). */
export function ensureAdmin(session: AppSession | null): AppSession {
  if (session?.appUser.role !== "admin") notFound();
  return session;
}

/** Hide or show a product in the client catalog via product_overrides. */
export async function setProductHidden(
  coArt: string,
  hidden: boolean,
): Promise<void> {
  await db
    .insert(productOverrides)
    .values({ coArt, isHidden: hidden })
    .onConflictDoUpdate({
      target: productOverrides.coArt,
      set: { isHidden: hidden, updatedAt: new Date() },
    });
}

/** Attach a product photo URL (Supabase Storage) via product_overrides. */
export async function setProductPhoto(
  coArt: string,
  photoUrl: string,
): Promise<void> {
  await db
    .insert(productOverrides)
    .values({ coArt, photoUrl })
    .onConflictDoUpdate({
      target: productOverrides.coArt,
      set: { photoUrl, updatedAt: new Date() },
    });
}

export type ActivateResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: "no_customer" };

/** Activate a contactless client by provisioning its app_user (idempotent). */
export async function activateClient(coCli: string): Promise<ActivateResult> {
  const [customer] = await db
    .select({ coCli: customers.coCli })
    .from(customers)
    .where(eq(customers.coCli, coCli))
    .limit(1);
  if (!customer) return { ok: false, reason: "no_customer" };

  const existing = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.coCli, coCli))
    .limit(1);
  if (existing.length > 0) return { ok: true, created: false };

  await db
    .insert(appUsers)
    .values({ coCli, role: "client" })
    .onConflictDoNothing({
      target: appUsers.coCli,
    });
  return { ok: true, created: true };
}

export type SyncStatusRow = {
  source: string;
  lastRowIdHex: string;
  lastRunAt: Date | null;
  lastStatus: string | null;
};

/** The sync freshness per source, for the admin dashboard. */
export async function getSyncStatus(): Promise<SyncStatusRow[]> {
  return db
    .select({
      source: syncState.source,
      lastRowIdHex: syncState.lastRowIdHex,
      lastRunAt: syncState.lastRunAt,
      lastStatus: syncState.lastStatus,
    })
    .from(syncState)
    .orderBy(syncState.source);
}

export type AdminProduct = {
  coArt: string;
  artDes: string;
  isHidden: boolean;
  photoUrl: string | null;
};

export async function listAdminProducts(limit = 100): Promise<AdminProduct[]> {
  const rows = await db
    .select({
      coArt: products.coArt,
      artDes: products.artDes,
      isHidden: productOverrides.isHidden,
      photoUrl: productOverrides.photoUrl,
    })
    .from(products)
    .leftJoin(productOverrides, eq(productOverrides.coArt, products.coArt))
    .orderBy(products.coArt)
    .limit(limit);
  return rows.map((r) => ({
    coArt: r.coArt,
    artDes: r.artDes,
    isHidden: r.isHidden ?? false,
    photoUrl: r.photoUrl,
  }));
}

export type AdminCustomer = {
  coCli: string;
  cliDes: string;
  email: string | null;
  activated: boolean;
};

export async function listCustomers(limit = 100): Promise<AdminCustomer[]> {
  const rows = await db
    .select({
      coCli: customers.coCli,
      cliDes: customers.cliDes,
      email: customers.email,
      appUserId: appUsers.id,
    })
    .from(customers)
    .leftJoin(appUsers, eq(appUsers.coCli, customers.coCli))
    .orderBy(desc(customers.coCli))
    .limit(limit);
  return rows.map((r) => ({
    coCli: r.coCli,
    cliDes: r.cliDes,
    email: r.email,
    activated: r.appUserId !== null,
  }));
}
