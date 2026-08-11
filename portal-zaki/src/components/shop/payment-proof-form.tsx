"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { registerProofAction } from "@/lib/payments/actions";

/** Payment-proof form (blueprint §9 step 10). Fields are collected with
 *  react-hook-form and submitted as multipart FormData; the server validates
 *  authoritatively, stores the image (signed URL) and notifies ZAKIPHARMA. */
export function PaymentProofForm() {
  const { register, reset } = useForm();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await registerProofAction(formData);
      if (result.ok) {
        setStatus("ok");
        reset();
      } else {
        setStatus("error");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
      encType="multipart/form-data"
    >
      {status === "ok" ? (
        <p
          className="rounded-lg border border-success p-3 text-success text-sm"
          role="status"
        >
          Comprobante registrado. Gracias.
        </p>
      ) : null}
      {status === "error" ? (
        <p
          className="rounded-lg border border-destructive p-3 text-destructive text-sm"
          role="alert"
        >
          Revisa los datos: todos los campos son obligatorios y la imagen es
          requerida.
        </p>
      ) : null}

      <label htmlFor="amount" className="font-medium text-fg text-sm">
        Monto
      </label>
      <input
        id="amount"
        type="number"
        step="0.01"
        min="0"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
        {...register("amount")}
      />

      <label htmlFor="currency" className="font-medium text-fg text-sm">
        Moneda
      </label>
      <select
        id="currency"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
        {...register("currency")}
      >
        <option value="BS">Bs</option>
        <option value="USD">USD</option>
      </select>

      <label htmlFor="method" className="font-medium text-fg text-sm">
        Método
      </label>
      <select
        id="method"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
        {...register("method")}
      >
        <option value="transfer">Transferencia</option>
        <option value="pago_movil">Pago móvil</option>
        <option value="deposit">Depósito</option>
      </select>

      <label htmlFor="reference" className="font-medium text-fg text-sm">
        Referencia
      </label>
      <input
        id="reference"
        type="text"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
        {...register("reference")}
      />

      <label htmlFor="image" className="font-medium text-fg text-sm">
        Comprobante (imagen)
      </label>
      <input
        id="image"
        name="image"
        type="file"
        accept="image/*"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
      />

      <label htmlFor="note" className="font-medium text-fg text-sm">
        Nota (opcional)
      </label>
      <textarea
        id="note"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
        {...register("note")}
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-fg disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Registrar comprobante"}
      </button>
    </form>
  );
}
