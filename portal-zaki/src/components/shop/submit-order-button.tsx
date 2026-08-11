"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitOrderAction } from "@/lib/orders/actions";

/** Client leaf: submit the cart as a quotation, then land on the account page. */
export function SubmitOrderButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitOrderAction();
      if (result.ok) {
        router.push("/cuenta");
        return;
      }
      setError(
        result.reason === "unavailable"
          ? `Revisa estos productos: ${result.offending.join(", ")}`
          : "No se pudo enviar el pedido.",
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-fg disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar pedido"}
      </button>
      {error ? (
        <span className="text-destructive text-sm" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
