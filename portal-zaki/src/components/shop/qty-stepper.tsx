"use client";

import { useState, useTransition } from "react";
import { removeCartLineAction, setCartQtyAction } from "@/lib/cart/actions";

/** Client leaf: adjust a cart line's quantity or remove it. Buttons provide a
 *  non-dragging alternative (WCAG 2.5.7) and are ≥24px targets (2.5.8). */
export function QtyStepper({ coArt, qty }: { coArt: string; qty: number }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function setQty(next: number) {
    startTransition(async () => {
      const result = await setCartQtyAction(coArt, next);
      setNotice(
        result.ok
          ? null
          : result.reason === "oversell"
            ? `Máximo disponible: ${result.available}`
            : "No se pudo actualizar",
      );
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartLineAction(coArt);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Disminuir cantidad"
          onClick={() => setQty(Math.max(0, qty - 1))}
          disabled={pending}
          className="size-9 rounded-lg border border-border text-fg"
        >
          −
        </button>
        <span className="min-w-8 text-center text-fg tabular-nums">{qty}</span>
        <button
          type="button"
          aria-label="Aumentar cantidad"
          onClick={() => setQty(qty + 1)}
          disabled={pending}
          className="size-9 rounded-lg border border-border text-fg"
        >
          +
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="ml-2 text-destructive text-sm underline"
        >
          Quitar
        </button>
      </div>
      {notice ? (
        <span className="text-destructive text-sm" role="alert">
          {notice}
        </span>
      ) : null}
    </div>
  );
}
