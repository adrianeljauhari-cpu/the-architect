import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Complete the OTP activation/login flow for a seeded, active customer. The code
 * is read from the guarded dev-only /api/dev/last-otp route (no mail transport in
 * tests). Lands on /catalogo.
 */
export async function login(
  page: Page,
  request: APIRequestContext,
  email = "farmacia0370@example.com",
): Promise<void> {
  await page.goto("/entrar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Enviar código" }).click();

  await page.waitForSelector("#otp");
  const res = await request.get(
    `/api/dev/last-otp?email=${encodeURIComponent(email)}`,
  );
  const body = await res.json();

  await page.locator("#otp").fill(body.data.otp);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/catalogo");
}
