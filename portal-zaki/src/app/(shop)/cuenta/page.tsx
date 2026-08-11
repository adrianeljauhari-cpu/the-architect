import Link from "next/link";
import { requireClient } from "@/lib/auth";
import {
  getAccountSummary,
  getClientOrders,
  getClientProofs,
} from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
}

export default async function CuentaPage() {
  const session = await requireClient();
  const coCli = session.appUser.co_cli;
  if (!coCli) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-fg-muted">Tu cuenta no tiene un cliente asociado.</p>
      </main>
    );
  }

  const [summary, orders, proofs] = await Promise.all([
    getAccountSummary(coCli),
    getClientOrders(coCli),
    getClientProofs(coCli),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl text-fg">
          {summary?.cliDes ?? "Mi cuenta"}
        </h1>
        <Link
          href="/cuenta/pagos"
          className="rounded-lg bg-primary px-4 py-2 text-primary-fg"
        >
          Registrar comprobante
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-fg-muted text-sm">Cupo de crédito</p>
          <p className="font-semibold text-fg text-lg">
            {summary?.sincredito
              ? "Contado"
              : `Bs ${summary?.montCre ?? "0.00"}`}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-fg-muted text-sm">Saldo</p>
          <p className="font-semibold text-fg text-lg">
            Bs {summary?.saldo ?? "0.00"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-fg-muted text-sm">Plazo de pago</p>
          <p className="font-semibold text-fg text-lg">
            {summary?.sincredito ? "Contado" : `${summary?.plazPag ?? 0} días`}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-fg text-xl">Pedidos</h2>
        {orders.length === 0 ? (
          <p className="text-fg-muted">Aún no has enviado pedidos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium text-fg">{order.orderNumber}</p>
                  <p className="text-fg-muted text-sm">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <p className="font-semibold text-fg">Bs {order.total}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-fg text-xl">Comprobantes</h2>
        {proofs.length === 0 ? (
          <p className="text-fg-muted">Aún no has registrado comprobantes.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {proofs.map((proof) => (
              <li
                key={proof.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium text-fg">
                    {proof.amount} {proof.currency} · {proof.reference}
                  </p>
                  <p className="text-fg-muted text-sm">
                    {formatDate(proof.createdAt)}
                  </p>
                </div>
                <p className="text-fg-muted text-sm">{proof.method}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
