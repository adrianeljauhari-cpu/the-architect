import { Resend } from "resend";
import { getEmailEnv, getProofNotifyEnv } from "@/lib/env";

/**
 * Transactional email via Resend (blueprint §9 step 9/10). The client and the
 * env are built LAZILY at send time, so the web build never needs a Resend key;
 * tests inject a double. Real delivery is verified once at launch (§13).
 */

export type QuotationLine = {
  coArt: string;
  artDes: string;
  qty: number;
  unitFrozen: string;
  lineNet: string;
};

export type Quotation = {
  orderNumber: string;
  coCli: string;
  clientEmail: string | null;
  usdBs: string;
  subtotal: string;
  total: string;
  applied1pct: boolean;
  lines: QuotationLine[];
};

export type QuotationSender = (quotation: Quotation) => Promise<void>;

function quotationText(q: Quotation): string {
  const lines = q.lines
    .map(
      (l) =>
        `  ${l.coArt}  ${l.artDes}  x${l.qty}  Bs ${l.unitFrozen} c/u  = Bs ${l.lineNet}`,
    )
    .join("\n");
  return [
    `Cotización ${q.orderNumber}`,
    `Cliente: ${q.coCli}`,
    `Tasa usada: Bs ${q.usdBs} / USD`,
    "",
    lines,
    "",
    `Subtotal: Bs ${q.subtotal}`,
    q.applied1pct ? "Descuento 1% aplicado" : "",
    `Total: Bs ${q.total}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const FROM = "PORTAL-ZAKI <cotizaciones@zakipharma.com>";

/** Send the quotation to ZAKIPHARMA (and the client, if it has an email). */
export const sendQuotationEmail: QuotationSender = async (quotation) => {
  const { RESEND_API_KEY, ORDER_NOTIFY_EMAIL } = getEmailEnv();
  const resend = new Resend(RESEND_API_KEY);
  const to = quotation.clientEmail
    ? [ORDER_NOTIFY_EMAIL, quotation.clientEmail]
    : [ORDER_NOTIFY_EMAIL];
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Cotización ${quotation.orderNumber} · ${quotation.coCli}`,
    text: quotationText(quotation),
  });
};

export type ProofNotification = {
  coCli: string;
  amount: string;
  currency: string;
  method: string;
  reference: string;
  imageUrl: string;
};

export type ProofSender = (proof: ProofNotification) => Promise<void>;

/** Notify ZAKIPHARMA that a client registered a payment proof. */
export const sendProofEmail: ProofSender = async (proof) => {
  const { RESEND_API_KEY, PROOF_NOTIFY_EMAIL } = getProofNotifyEnv();
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: [PROOF_NOTIFY_EMAIL],
    subject: `Comprobante de pago · ${proof.coCli}`,
    text: [
      `Cliente: ${proof.coCli}`,
      `Monto: ${proof.amount} ${proof.currency}`,
      `Método: ${proof.method}`,
      `Referencia: ${proof.reference}`,
      `Comprobante: ${proof.imageUrl}`,
    ].join("\n"),
  });
};
