"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/lib/cart/actions";

/** Client leaf: adds one unit to the cart. The price is never sent — the server
 *  recomputes it. Reports oversell with the available amount. */
export function AddToCartButton({
  coArt,
  disabled,
}: {
  coArt: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    startTransition(async () => {
      const result = await addToCartAction(coArt, 1);
      if (result.ok) {
        setMessage("Agregado al carrito");
      } else if (result.reason === "oversell") {
        setMessage(`Máximo disponible: ${result.available}`);
      } else {
        setMessage("No disponible");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={add}
        disabled={disabled || pending}
        className="min-h-9 rounded-lg bg-primary px-4 py-2 font-medium text-primary-fg disabled:opacity-60"
      >
        {pending ? "Agregando…" : "Agregar"}
      </button>
      {message ? (
        <span className="text-fg-muted text-sm" aria-live="polite">
          {message}
        </span>
      ) : null}
    </div>
  );
}
