import Big from "big.js";

/**
 * Money math for the price cascade (.claude/rules/pricing.md). NEVER floats:
 * Profit unit prices carry up to 5 decimals and the cascade is multiplicative,
 * so a chained float would drift off the cent. All arithmetic is `big.js`;
 * line nets and totals round to 2 decimals only at the very end.
 */

export type BigSource = Big | string | number;

export const toBig = (value: BigSource): Big => new Big(value);

/** A single cascade factor: `(1 - pct/100)`. `pct` is a percentage like 17 or 12.5. */
export function discountFactor(pct: BigSource): Big {
  return new Big(1).minus(new Big(pct).div(100));
}

/** Round a monetary value to 2 decimals (half-up, big.js default) as a string. */
export function round2(value: Big): string {
  return value.toFixed(2);
}

/** Round a unit price to 5 decimals (Profit's unit-price scale) as a string. */
export function round5(value: Big): string {
  return value.toFixed(5);
}
