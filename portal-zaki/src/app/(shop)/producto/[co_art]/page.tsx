import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { getCatalogProduct } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function ProductoPage({
  params,
}: PageProps<"/producto/[co_art]">) {
  const session = await requireClient();
  const coCli = session.appUser.co_cli;
  if (!coCli) notFound();

  const { co_art } = await params;
  const item = await getCatalogProduct(coCli, decodeURIComponent(co_art));
  if (!item) notFound();

  const soldOut = item.disponible <= 0;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Link href="/catalogo" className="text-fg-muted text-sm hover:underline">
        ← Volver al catálogo
      </Link>
      <h1 className="font-semibold text-2xl text-fg">{item.artDes}</h1>
      <p className="font-semibold text-fg text-xl">
        Bs {item.priceBs}
        {item.priceUsd ? (
          <span className="text-base text-fg-muted">
            {" "}
            · USD {item.priceUsd}
          </span>
        ) : null}
      </p>
      <p className={soldOut ? "text-destructive" : "text-fg-muted"}>
        {soldOut ? "No disponible" : `Disponible: ${item.disponible}`}
      </p>
    </main>
  );
}
