import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getCatalogProduct,
  getPricingClient,
  listCatalog,
} from "@/lib/catalog/queries";
import { db } from "@/lib/db/index";
import { productOverrides } from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import { price } from "@/lib/pricing/price";

const AT = new Date("2026-08-11T12:00:00Z");

describe("catalog per-client pricing", () => {
  beforeAll(async () => {
    await seed();
    await db.delete(productOverrides).where(eq(productOverrides.coArt, "A005"));
  });
  afterAll(async () => {
    await db.delete(productOverrides).where(eq(productOverrides.coArt, "A005"));
    await db.$client.end({ timeout: 5 });
  });

  it("prices each product with THAT client's desc_glob and offers", async () => {
    const client0370 = await getPricingClient("0370");
    const client0002 = await getPricingClient("0002");
    expect(client0370).not.toBeNull();
    expect(client0002).not.toBeNull();
    if (!client0370 || !client0002) return;

    const page0370 = await listCatalog({ coCli: "0370", at: AT });
    const page0002 = await listCatalog({ coCli: "0002", at: AT });

    const a1_0370 = page0370.items.find((i) => i.coArt === "A001");
    const a1_0002 = page0002.items.find((i) => i.coArt === "A001");
    expect(a1_0370).toBeDefined();
    expect(a1_0002).toBeDefined();

    // matches the canonical pricing engine, per client
    const expected0370 = await price(
      client0370,
      { coArt: "A001", precVta1: "2165.23" },
      1,
      AT,
    );
    const expected0002 = await price(
      client0002,
      { coArt: "A001", precVta1: "2165.23" },
      1,
      AT,
    );
    expect(a1_0370?.priceBs).toBe(expected0370.lineNet);
    expect(a1_0002?.priceBs).toBe(expected0002.lineNet);

    // different clients → different prices (0370 also has the p2 oferta_cli)
    expect(a1_0370?.priceBs).not.toBe(a1_0002?.priceBs);

    // both carry a USD price from the mirror rate
    expect(a1_0370?.priceUsd).toBeTruthy();
  });

  it("omits a hidden product from the listing and 404s its PDP", async () => {
    await db
      .insert(productOverrides)
      .values({ coArt: "A005", isHidden: true })
      .onConflictDoUpdate({
        target: productOverrides.coArt,
        set: { isHidden: true },
      });

    const page = await listCatalog({ coCli: "0370", at: AT });
    expect(page.items.find((i) => i.coArt === "A005")).toBeUndefined();

    const pdp = await getCatalogProduct("0370", "A005", AT);
    expect(pdp).toBeNull();
  });

  it("shows an out-of-stock product marked (disponible 0), not hidden", async () => {
    const page = await listCatalog({ coCli: "0370", at: AT });
    const a010 = page.items.find((i) => i.coArt === "A010"); // seeded stock 0/0
    expect(a010).toBeDefined();
    expect(a010?.disponible).toBe(0);
  });

  it("searches art_des via the text index, capped at the page size", async () => {
    const page = await listCatalog({
      coCli: "0370",
      search: "OMEPRAZOL",
      at: AT,
    });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.length).toBeLessThanOrEqual(60);
    for (const item of page.items) {
      expect(item.artDes).toContain("OMEPRAZOL");
    }
  });
});
