import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  activateClient,
  ensureAdmin,
  getSyncStatus,
  setProductHidden,
} from "@/lib/admin/server";
import type { AppSession } from "@/lib/auth";
import { getCatalogProduct } from "@/lib/catalog/queries";
import { db } from "@/lib/db/index";
import { appUsers, productOverrides, syncState } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";

const adminSession: AppSession = {
  appUser: { id: "admin-1", co_cli: null, role: "admin" },
  email: "admin@zakipharma.com",
};
const clientSession: AppSession = {
  appUser: { id: "client-1", co_cli: "0370", role: "client" },
  email: "c@example.com",
};

describe("admin panel", () => {
  beforeAll(async () => {
    await seed();
  });
  beforeEach(async () => {
    await db.delete(appUsers).where(eq(appUsers.coCli, "0070"));
    await db.delete(productOverrides).where(eq(productOverrides.coArt, "A005"));
  });
  afterAll(async () => {
    await db.delete(appUsers).where(eq(appUsers.coCli, "0070"));
    await db.delete(productOverrides).where(eq(productOverrides.coArt, "A005"));
    await db.$client.end({ timeout: 5 });
  });

  it("404s any non-admin and passes an admin", () => {
    expect(() => ensureAdmin(clientSession)).toThrow();
    expect(() => ensureAdmin(null)).toThrow();
    expect(ensureAdmin(adminSession)).toBe(adminSession);
  });

  it("hides a product so it disappears from the client catalog", async () => {
    expect(await getCatalogProduct("0370", "A005")).not.toBeNull();

    await setProductHidden("A005", true);
    expect(await getCatalogProduct("0370", "A005")).toBeNull();

    await setProductHidden("A005", false);
    expect(await getCatalogProduct("0370", "A005")).not.toBeNull();
  });

  it("activates a contactless client by creating its app_user (idempotent)", async () => {
    const first = await activateClient("0070"); // seeded EXCLUIDOS client, no email
    expect(first).toEqual({ ok: true, created: true });

    const rows = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.coCli, "0070"));
    expect(rows).toHaveLength(1);

    const second = await activateClient("0070");
    expect(second).toEqual({ ok: true, created: false });

    const notACustomer = await activateClient("9999");
    expect(notACustomer).toEqual({ ok: false, reason: "no_customer" });
  });

  it("shows the last sync time per source", async () => {
    const when = new Date("2026-08-11T12:00:00Z");
    await db
      .insert(syncState)
      .values({
        source: "art",
        lastRowIdHex: "0x00000000000000FF",
        lastRunAt: when,
        lastStatus: "ok",
      })
      .onConflictDoUpdate({
        target: syncState.source,
        set: {
          lastRunAt: when,
          lastStatus: "ok",
          lastRowIdHex: "0x00000000000000FF",
        },
      });

    const status = await getSyncStatus();
    const art = status.find((s) => s.source === "art");
    expect(art?.lastStatus).toBe("ok");
    expect(art?.lastRunAt).not.toBeNull();
  });
});
