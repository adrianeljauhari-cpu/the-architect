import type Big from "big.js";
import { discountFactor, toBig } from "@/lib/money";

/**
 * The multiplicative cascade (.claude/rules/pricing.md):
 *   neto_unit = prec_vta1 × (1-p1)(1-p2)(1-p3)(1-p4)
 * The discounts CHAIN — `0+6+17+12` is NOT 35%. `porc_max` (from `product_caps`)
 * is a hard ceiling on the TOTAL discount; it is a no-op in v1 (`art_ext` empty)
 * but applied defensively whenever a cap exists.
 */

/** [p1, p2, p3, p4] as percentages (0..100). p2 is `oferta_cli`; p4 is `desc_glob`. */
export type CascadePositions = readonly number[];

/** Combined discount factor, capped so the total discount never exceeds `porcMax`. */
export function cascadeFactor(
  positions: CascadePositions,
  porcMax?: number | null,
): Big {
  let factor = positions.reduce(
    (acc, pct) => acc.times(discountFactor(pct)),
    toBig(1),
  );

  if (porcMax != null) {
    const capFactor = discountFactor(porcMax);
    // A smaller factor means a bigger discount; cap it at the ceiling.
    if (factor.lt(capFactor)) factor = capFactor;
  }

  return factor;
}

/** Net unit price after the cascade (full precision — round only for display). */
export function unitNet(
  precVta1: string | number,
  positions: CascadePositions,
  porcMax?: number | null,
): Big {
  return toBig(precVta1).times(cascadeFactor(positions, porcMax));
}

export type LineNet = { unit: Big; net: Big };

/** Net unit price and the line net (unit × qty), both at full precision. */
export function lineNet(
  precVta1: string | number,
  qty: string | number,
  positions: CascadePositions,
  porcMax?: number | null,
): LineNet {
  const unit = unitNet(precVta1, positions, porcMax);
  return { unit, net: unit.times(toBig(qty)) };
}
