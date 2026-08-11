import { setPhotoAction, toggleHiddenAction } from "@/lib/admin/actions";
import { listAdminProducts } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

export default async function AdminProductosPage() {
  const items = await listAdminProducts();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl text-fg">Productos</h1>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((product) => (
          <li
            key={product.coArt}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="min-w-48 flex-1">
              <p className="font-medium text-fg">{product.artDes}</p>
              <p className="text-fg-muted text-sm">
                {product.coArt}
                {product.isHidden ? " · oculto" : ""}
              </p>
            </div>

            <form action={toggleHiddenAction}>
              <input type="hidden" name="coArt" value={product.coArt} />
              <input
                type="hidden"
                name="hidden"
                value={String(!product.isHidden)}
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-fg text-sm"
              >
                {product.isHidden ? "Mostrar" : "Ocultar"}
              </button>
            </form>

            <form action={setPhotoAction} className="flex items-center gap-2">
              <input type="hidden" name="coArt" value={product.coArt} />
              <input
                type="url"
                name="photoUrl"
                placeholder="URL de foto"
                aria-label={`URL de foto para ${product.coArt}`}
                className="w-44 rounded-lg border border-border bg-surface px-2 py-1.5 text-fg text-sm"
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-fg text-sm"
              >
                Guardar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
