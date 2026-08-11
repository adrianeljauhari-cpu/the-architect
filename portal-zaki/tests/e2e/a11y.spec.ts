import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("catálogo and carrito have no accessibility violations", async ({
  page,
  request,
}) => {
  await login(page, request);

  const catalog = await new AxeBuilder({ page }).analyze();
  expect(catalog.violations).toEqual([]);

  // put an item in the cart so the cart page renders its full content
  await page.getByRole("button", { name: "Agregar" }).first().click();
  await page.goto("/carrito");
  await expect(
    page.getByRole("button", { name: "Enviar pedido" }),
  ).toBeVisible();

  const cart = await new AxeBuilder({ page }).analyze();
  expect(cart.violations).toEqual([]);
});
