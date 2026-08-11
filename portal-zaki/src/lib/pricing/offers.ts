/**
 * Resolve the vigente offer percentages for a (client, product) at a moment
 * (.claude/rules/pricing.md). Pure — takes candidate rows, returns percentages,
 * so it is unit-testable without a database.
 *
 * Positions:
 *   p1 = `oferta pos_ofer=0` (provider, by segment)
 *   p2 = `oferta_cli`        (by tipo/grupo or by client)
 *   p3 = `oferta pos_ofer=1` (drugstore, by segment)
 *   p4 = `customers.desc_glob` (handled in price.ts)
 *
 * A segment offer applies when the client's SEGMENT falls in [co_seg_d, co_seg_h]
 * OR the client's code falls in [co_cli_d, co_cli_h], within vigencia, and the
 * product is in the offer's lines. EXCLUIDOS = segment 70: a segment-70 client
 * only matches offers configured for segment 70 — there is no text matching.
 */

export type OfferHeader = {
  coOfer: string;
  posOfer: number;
  fecInic: Date | string;
  fecFin: Date | string;
  coSegD?: string | null;
  coSegH?: string | null;
  coCliD?: string | null;
  coCliH?: string | null;
};

export type OfferLine = {
  coOfer: string;
  coArt: string;
  porcOfer: string | number;
};

export type CustomerOfferHeader = {
  coOfer: string;
  fecInic: Date | string;
  fecFin: Date | string;
  tipoD?: string | null;
  tipoH?: string | null;
  coCliD?: string | null;
  coCliH?: string | null;
};

export type CustomerOfferLine = {
  coOfer: string;
  coCli: string;
  porcOfer: string | number;
};

export type PricingClient = {
  coCli: string;
  coSeg?: string | null;
  tipo?: string | null;
  descGlob: string | number;
  cond1pct?: boolean;
};

export type OfferInputs = {
  client: PricingClient;
  coArt: string;
  at: Date | string;
  offers: OfferHeader[];
  offerLines: OfferLine[];
  customerOffers: CustomerOfferHeader[];
  customerOfferLines: CustomerOfferLine[];
};

export type ResolvedPercents = { p1: number; p2: number; p3: number };

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function vigente(at: Date, from: Date | string, to: Date | string): boolean {
  const a = at.getTime();
  return a >= toDate(from).getTime() && a <= toDate(to).getTime();
}

/** Inclusive range test. Numeric when all three parse as numbers (segments, codes);
 *  string comparison otherwise (tipo/grupo). Null/empty bounds never match. */
function inRange(
  value: string | null | undefined,
  low: string | null | undefined,
  high: string | null | undefined,
): boolean {
  if (
    value == null ||
    low == null ||
    high == null ||
    low === "" ||
    high === ""
  ) {
    return false;
  }
  const nv = Number(value);
  const nl = Number(low);
  const nh = Number(high);
  if (!Number.isNaN(nv) && !Number.isNaN(nl) && !Number.isNaN(nh)) {
    return nv >= nl && nv <= nh;
  }
  return value >= low && value <= high;
}

export function resolveOfferPercents(input: OfferInputs): ResolvedPercents {
  const {
    client,
    coArt,
    offers,
    offerLines,
    customerOffers,
    customerOfferLines,
  } = input;
  const at = toDate(input.at);

  let p1 = 0;
  let p3 = 0;
  for (const offer of offers) {
    if (!vigente(at, offer.fecInic, offer.fecFin)) continue;
    const line = offerLines.find(
      (l) => l.coOfer === offer.coOfer && l.coArt === coArt,
    );
    if (!line) continue; // product not in this offer's scope

    const bySegment = inRange(client.coSeg, offer.coSegD, offer.coSegH);
    const byClient = inRange(client.coCli, offer.coCliD, offer.coCliH);
    if (!bySegment && !byClient) continue;

    const pct = Number(line.porcOfer);
    if (offer.posOfer === 0) p1 = Math.max(p1, pct);
    else if (offer.posOfer === 1) p3 = Math.max(p3, pct);
  }

  let p2 = 0;
  for (const offer of customerOffers) {
    if (!vigente(at, offer.fecInic, offer.fecFin)) continue;
    const byTipo = inRange(client.tipo, offer.tipoD, offer.tipoH);
    const byClient = inRange(client.coCli, offer.coCliD, offer.coCliH);
    if (!byTipo && !byClient) continue;

    const line = customerOfferLines.find(
      (l) => l.coOfer === offer.coOfer && l.coCli === client.coCli,
    );
    if (!line) continue;
    p2 = Math.max(p2, Number(line.porcOfer));
  }

  return { p1, p2, p3 };
}
