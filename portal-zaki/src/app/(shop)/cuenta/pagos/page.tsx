import { PaymentProofForm } from "@/components/shop/payment-proof-form";
import { requireClient } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PagosPage() {
  await requireClient();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="font-semibold text-2xl text-fg">
        Registrar comprobante de pago
      </h1>
      <p className="text-fg-muted text-sm">
        Sube tu comprobante (transferencia, pago móvil o depósito). El equipo de
        ZAKIPHARMA lo recibe para conciliar tu pago.
      </p>
      <PaymentProofForm />
    </main>
  );
}
