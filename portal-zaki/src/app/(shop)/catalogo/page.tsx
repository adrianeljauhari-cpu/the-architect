import Link from "next/link";
import { ProductCard } from "@/components/shop/product-card";
import { requireClient } from "@/lib/auth";
import { listCatalog } from "@/lib/catalog/queries";

// Price is per user, so this page is never cached between clients.
export const dynamic = "force-dynamic";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function CatalogoPage({
  searchParams,
}: PageProps<"/catalogo">) {
  const session = await requireClient();
  const coCli = session.appUser.co_cli;
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  if (!coCli) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-fg-muted">Tu cuenta no tiene un cliente asociado.</p>
      </main>
    );
  }

  const page = await listCatalog({ coCli, search, cursor });
  const nextParams = new URLSearchParams();
  if (search) nextParams.set("q", search);
  if (page.nextCursor) nextParams.set("cursor", page.nextCursor);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl text-fg">Catálogo</h1>
        <form className="flex gap-2" action="/catalogo">
          <input
            name="q"
            defaultValue={search}
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-primary-fg"
          >
            Buscar
          </button>
        </form>
      </header>

      {page.rateAt ? (
        <p className="text-fg-muted text-sm">
          Tasa de {formatTime(page.rateAt)}: Bs {page.usdBs} / USD
        </p>
      ) : null}

      {page.items.length === 0 ? (
        <p className="text-fg-muted">Sin resultados para tu búsqueda.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((item) => (
            <li key={item.coArt}>
              <ProductCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {page.nextCursor ? (
        <Link
          href={`/catalogo?${nextParams.toString()}`}
          className="self-center rounded-lg border border-border px-4 py-2 text-fg"
        >
          Ver más
        </Link>
      ) : null}
    </main>
  );
}
