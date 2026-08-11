import { activateClientAction } from "@/lib/admin/actions";
import { listCustomers } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

export default async function AdminClientesPage() {
  const customers = await listCustomers();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl text-fg">Clientes</h1>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {customers.map((customer) => (
          <li
            key={customer.coCli}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-48 flex-1">
              <p className="font-medium text-fg">{customer.cliDes}</p>
              <p className="text-fg-muted text-sm">
                {customer.coCli} · {customer.email ?? "sin correo"}
              </p>
            </div>
            {customer.activated ? (
              <span className="text-fg-muted text-sm">Activo</span>
            ) : (
              <form action={activateClientAction}>
                <input type="hidden" name="coCli" value={customer.coCli} />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-1.5 text-primary-fg text-sm"
                >
                  Activar
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
