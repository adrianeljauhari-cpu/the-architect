import Link from "next/link";
import { ensureAdmin } from "@/lib/admin/server";
import { getSession } from "@/lib/auth";

// Admin is per-request and never cached. A non-admin gets 404, not 403.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  ensureAdmin(await getSession());
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <nav className="flex gap-4 border-border border-b pb-3 text-sm">
        <Link href="/admin" className="text-fg hover:underline">
          Sincronización
        </Link>
        <Link href="/admin/productos" className="text-fg hover:underline">
          Productos
        </Link>
        <Link href="/admin/clientes" className="text-fg hover:underline">
          Clientes
        </Link>
      </nav>
      {children}
    </div>
  );
}
