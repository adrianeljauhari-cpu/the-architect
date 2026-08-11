"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

/**
 * OTP activation / sign-in (blueprint §8). Step 1 asks for the email and always
 * shows a generic message — the server only delivers a code to an active
 * customer, so this never reveals whether an email is registered. Step 2 verifies
 * the code; a valid code provisions the app_user server-side and lands on /catalogo.
 */

const emailSchema = z.object({ email: z.email() });
const otpSchema = z.object({
  otp: z.string().min(4, "Ingresa el código completo"),
});

const GENERIC_SENT =
  "Si tu correo está registrado, te enviamos un código de acceso.";

export function OtpSignInForm({ heading }: { heading: string }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const emailForm = useForm<{ email: string }>({
    defaultValues: { email: "" },
  });
  const otpForm = useForm<{ otp: string }>({ defaultValues: { otp: "" } });

  async function sendOtp(values: { email: string }) {
    setError(null);
    const parsed = emailSchema.safeParse(values);
    if (!parsed.success) {
      setError("Ingresa un correo válido.");
      return;
    }
    setPending(true);
    try {
      await fetch("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email, type: "sign-in" }),
      });
      setEmail(parsed.data.email);
      setStep("otp");
      setNotice(GENERIC_SENT);
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp(values: { otp: string }) {
    setError(null);
    const parsed = otpSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Código inválido.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/sign-in/email-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, otp: parsed.data.otp }),
      });
      if (!res.ok) {
        setError("El código es incorrecto o expiró. Solicita uno nuevo.");
        return;
      }
      window.location.href = "/catalogo";
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="font-semibold text-2xl text-fg">{heading}</h1>

      {notice ? (
        <p
          className="rounded-lg border border-border bg-surface p-3 text-fg-muted text-sm"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-lg border border-destructive p-3 text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {step === "email" ? (
        <form
          onSubmit={emailForm.handleSubmit(sendOtp)}
          className="flex flex-col gap-3"
          noValidate
        >
          <label htmlFor="email" className="font-medium text-fg text-sm">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
            {...emailForm.register("email")}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-fg disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Enviar código"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={otpForm.handleSubmit(verifyOtp)}
          className="flex flex-col gap-3"
          noValidate
        >
          <label htmlFor="otp" className="font-medium text-fg text-sm">
            Código de acceso enviado a {email}
          </label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-fg"
            {...otpForm.register("otp")}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-fg disabled:opacity-60"
          >
            {pending ? "Verificando…" : "Entrar"}
          </button>
          <button
            type="button"
            className="text-fg-muted text-sm underline"
            onClick={() => {
              setStep("email");
              setNotice(null);
            }}
          >
            Usar otro correo
          </button>
        </form>
      )}
    </main>
  );
}
