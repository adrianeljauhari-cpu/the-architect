import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("login → catálogo → carrito → enviar pedido creates a quotation", async ({
  page,
  request,
}) => {
  await login(page, request);

  // add the first available product to the cart
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await expect(page.getByText("Agregado al carrito").first()).toBeVisible();

  await page.goto("/carrito");
  await expect(
    page.getByRole("button", { name: "Enviar pedido" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enviar pedido" }).click();

  // lands on the account page with a quotation reference (PZ-…)
  await page.waitForURL("**/cuenta");
  await expect(page.getByText(/PZ-/).first()).toBeVisible();
});
