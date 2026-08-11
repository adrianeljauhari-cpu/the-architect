import { describe, expect, it } from "vitest";
import { round2 } from "@/lib/money";
import { lineNet } from "@/lib/pricing/cascade";
import { type OfferInputs, resolveOfferPercents } from "@/lib/pricing/offers";

/**
 * The money path. The four line nets are real Profit invoice lines (dossier
 * §3.4) and are SACRED — if they change, the cascade is wrong.
 */
describe("cascade — real invoice lines to the cent", () => {
  const cases = [
    { prec: "2165.23", qty: 6, positions: [0, 6, 17, 12], expected: "8919.57" },
    { prec: "589.84", qty: 20, positions: [0, 6, 34, 12], expected: "6440.49" },
    {
      prec: "746.63",
      qty: 50,
      positions: [0, 0, 13, 12],
      expected: "28581.00",
    },
    { prec: "671.97", qty: 90, positions: [0, 0, 4, 12], expected: "51091.22" },
  ];

  for (const c of cases) {
    it(`prec ${c.prec} × qty ${c.qty} @ (${c.positions.join(",")}) = ${c.expected}`, () => {
      const { net } = lineNet(c.prec, c.qty, c.positions);
      expect(round2(net)).toBe(c.expected);
    });
  }

  it("chains discounts multiplicatively (0+6+17+12 is not 35%)", () => {
    // 35% flat would give 1407.40; the cascade gives 1486.59
    const { unit } = lineNet("2165.23", 1, [0, 6, 17, 12]);
    expect(unit.toFixed(5)).toBe("1486.59495");
  });
});

describe("cascade — porc_max cap", () => {
  it("caps the total discount at porc_max", () => {
    // positions alone: 0.5 × 0.88 = 0.44 → 56% discount, capped to 15%
    const capped = lineNet("1000", 1, [0, 0, 50, 12], 15);
    expect(round2(capped.net)).toBe("850.00");

    const uncapped = lineNet("1000", 1, [0, 0, 50, 12]);
    expect(round2(uncapped.net)).toBe("440.00");
  });

  it("leaves a discount below the cap untouched", () => {
    const { net } = lineNet("1000", 1, [0, 0, 10, 0], 15);
    expect(round2(net)).toBe("900.00");
  });
});

describe("offers — EXCLUIDOS is segment 70", () => {
  const at = new Date("2026-08-11T12:00:00Z");
  const base: Omit<OfferInputs, "client"> = {
    coArt: "A001",
    at,
    offers: [
      {
        coOfer: "OF-P1",
        posOfer: 0,
        fecInic: new Date("2026-08-01"),
        fecFin: new Date("2026-09-01"),
        coSegD: "10",
        coSegH: "60",
      },
      {
        coOfer: "OF-P3",
        posOfer: 1,
        fecInic: new Date("2026-08-01"),
        fecFin: new Date("2026-09-01"),
        coSegD: "10",
        coSegH: "60",
      },
      {
        coOfer: "OF-EXC",
        posOfer: 1,
        fecInic: new Date("2026-08-01"),
        fecFin: new Date("2026-09-01"),
        coSegD: "70",
        coSegH: "70",
      },
    ],
    offerLines: [
      { coOfer: "OF-P1", coArt: "A001", porcOfer: "6" },
      { coOfer: "OF-P3", coArt: "A001", porcOfer: "17" },
      { coOfer: "OF-EXC", coArt: "A001", porcOfer: "5" },
    ],
    customerOffers: [],
    customerOfferLines: [],
  };

  it("a general-segment client takes the general offers", () => {
    const result = resolveOfferPercents({
      ...base,
      client: { coCli: "0370", coSeg: "10", tipo: "MAY", descGlob: "12" },
    });
    expect(result).toEqual({ p1: 6, p2: 0, p3: 17 });
  });

  it("a segment-70 (EXCLUIDOS) client takes ONLY segment-70 offers", () => {
    const result = resolveOfferPercents({
      ...base,
      client: { coCli: "0070", coSeg: "70", tipo: "EXC", descGlob: "0" },
    });
    expect(result).toEqual({ p1: 0, p2: 0, p3: 5 });
  });
});

describe("offers — position 2 (oferta_cli) and vigencia", () => {
  const at = new Date("2026-08-11T12:00:00Z");

  it("applies oferta_cli by tipo, only within vigencia", () => {
    const inputs: OfferInputs = {
      client: { coCli: "0370", coSeg: "10", tipo: "MAY", descGlob: "12" },
      coArt: "A001",
      at,
      offers: [],
      offerLines: [],
      customerOffers: [
        {
          coOfer: "CO-P2",
          fecInic: new Date("2026-08-01"),
          fecFin: new Date("2026-09-01"),
          tipoD: "MAY",
          tipoH: "MAY",
        },
      ],
      customerOfferLines: [{ coOfer: "CO-P2", coCli: "0370", porcOfer: "6" }],
    };
    expect(resolveOfferPercents(inputs)).toEqual({ p1: 0, p2: 6, p3: 0 });

    // expired offer contributes nothing
    const expired: OfferInputs = {
      ...inputs,
      customerOffers: [
        {
          coOfer: "CO-P2",
          fecInic: new Date("2026-01-01"),
          fecFin: new Date("2026-02-01"),
          tipoD: "MAY",
          tipoH: "MAY",
        },
      ],
    };
    expect(resolveOfferPercents(expired)).toEqual({ p1: 0, p2: 0, p3: 0 });
  });
});
