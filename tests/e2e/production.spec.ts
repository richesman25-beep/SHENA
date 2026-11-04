import { test, expect } from "@playwright/test";
test("sans configuration réelle aucun exemple ne devient un produit à vendre", async ({
  page,
}) => {
  for (const path of ["/", "/boutique", "/numerique"]) {
    await page.goto(path);
    await expect(page.locator(".product-card")).toHaveCount(0);
    await expect(page.locator(".catalog-status").first()).toContainText(
      "pas encore configuré",
    );
  }
  await page.goto("/produit/sneakers-shena-demo");
  await expect(page.locator(".catalog-status")).toContainText(
    "pas encore configuré",
  );
});
test("admin, sous-routes et connexion refusent l’accès sans configuration", async ({
  page,
}) => {
  for (const path of [
    "/admin",
    "/admin/produits",
    "/admin/produits/nouveau",
    "/admin/categories",
    "/admin/digital",
    "/admin/stocks",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Administration indisponible",
    );
    await expect(page.locator('input[name="price_htg"]')).toHaveCount(0);
  }
  await page.goto("/admin/connexion");
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("body")).toContainText("Supabase non configuré");
  await page.screenshot({
    path: "test-results/shena-admin-unconfigured.png",
    fullPage: true,
  });
});
test("proximité réelle non configurée reste explicitement indisponible", async ({
  page,
}) => {
  await page.goto("/boutique");
  await expect(
    page.getByRole("checkbox", { name: "Disponible près de moi", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".filters:visible")).toContainText(
    "Stocks géographiques réels non configurés",
  );
  await page.goto("/panier");
  await expect(page.locator(".catalog-status")).toContainText(
    "pas encore configuré",
  );
});
