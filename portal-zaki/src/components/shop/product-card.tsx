import Link from "next/link";
import type { CatalogItem } from "@/lib/catalog/queries";

/** A catalog tile: name, per-client price (Bs · USD), and stock. Out-of-stock is
 *  marked "No disponible" — never hidden (dossier §2.8). Server component. */
export function ProductCard({ item }: { item: CatalogItem }) {
  const soldOut = item.disponible <= 0;
  return (
    <article className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <Link
        href={`/producto/${encodeURIComponent(item.coArt)}`}
        className="font-medium text-fg hover:underline"
      >
        {item.artDes}
      </Link>
      <p className="text-fg">
        <span className="font-semibold">Bs {item.priceBs}</span>
        {item.priceUsd ? (
          <span className="text-fg-muted text-sm"> · USD {item.priceUsd}</span>
        ) : null}
      </p>
      <p
        className={
          soldOut ? "text-destructive text-sm" : "text-fg-muted text-sm"
        }
      >
        {soldOut ? "No disponible" : `Disponible: ${item.disponible}`}
      </p>
    </article>
  );
}
