import Link from "next/link";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { requireClient } from "@/lib/auth";
import { getCart } from "@/lib/cart/server";

// Per-client data, recomputed every read — never cached.
export const dynamic = "force-dynamic";

export default async function CarritoPage() {
  const session = await requireClient();
  const cart = await getCart({
    id: session.appUser.id,
    co_cli: session.appUser.co_cli,
  });

  if (cart.lines.length === 0) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <h1 className="font-semibold text-2xl text-fg">Tu carrito</h1>
        <p className="text-fg-muted">Tu carrito está vacío.</p>
        <Link href="/catalogo" className="text-primary underline">
          Ir al catálogo
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="font-semibold text-2xl text-fg">Tu carrito</h1>

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {cart.lines.map((line) => (
          <li
            key={line.coArt}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-40 flex-1">
              <p className="font-medium text-fg">{line.artDes}</p>
              <p className="text-fg-muted text-sm">
                Bs {line.unitFrozen} c/u · disponible {line.disponible}
              </p>
            </div>
            <QtyStepper coArt={line.coArt} qty={line.qty} />
            <p className="w-28 text-right font-semibold text-fg">
              Bs {line.lineNet}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-end gap-1">
        <p className="text-fg-muted text-sm">Subtotal: Bs {cart.subtotal}</p>
        {cart.applied1pct ? (
          <p className="text-fg-muted text-sm">Descuento 1% aplicado</p>
        ) : null}
        <p className="font-semibold text-fg text-lg">Total: Bs {cart.total}</p>
      </div>
    </main>
  );
}
