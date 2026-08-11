import { eq } from "drizzle-orm";
import { afterAll, describe, expect, expectTypeOf, it } from "vitest";
import { db } from "@/lib/db/index";
import { products } from "@/lib/db/schema";

/**
 * Integration: the exported Drizzle client returns typed rows for a seeded
 * product. Requires `pnpm db:migrate && pnpm db:seed` first (the E1-T2 verify
 * sequence runs both). No `any` — proven by the compile-time type assertions.
 */
describe("db client", () => {
  afterAll(async () => {
    await db.$client.end({ timeout: 5 });
  });

  it("returns typed rows for a seeded product", async () => {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.coArt, "A001"));

    expect(rows).toHaveLength(1);
    const product = rows[0];

    // numeric columns come back as strings — the exact type, never `any`
    expectTypeOf(product.coArt).toEqualTypeOf<string>();
    expectTypeOf(product.precVta1).toEqualTypeOf<string>();
    expectTypeOf(product.anulado).toEqualTypeOf<boolean>();

    expect(product.artDes).toContain("OMEPRAZOL");
    expect(Number(product.precVta1)).toBe(2165.23);
    expect(Number(product.stockAct)).toBe(500);
    expect(product.anulado).toBe(false);
  });
});
