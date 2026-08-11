import { getSyncStatus } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

function formatWhen(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminDashboardPage() {
  const status = await getSyncStatus();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl text-fg">
        Estado de sincronización
      </h1>
      {status.length === 0 ? (
        <p className="text-fg-muted">
          Aún no hay corridas de sincronización registradas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-border border-b text-fg-muted">
              <tr>
                <th className="p-3">Fuente</th>
                <th className="p-3">Última corrida</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {status.map((row) => (
                <tr
                  key={row.source}
                  className="border-border/60 border-b last:border-0"
                >
                  <td className="p-3 font-medium text-fg">{row.source}</td>
                  <td className="p-3 text-fg">{formatWhen(row.lastRunAt)}</td>
                  <td className="p-3 text-fg-muted">{row.lastStatus ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
