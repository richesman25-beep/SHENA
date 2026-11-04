import { test, expect, type Page } from "@playwright/test";
async function choose(page: Page, department: string, commune: string) {
  await page.locator(".filters:visible .location-trigger").click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Département", { exact: true })
    .selectOption(department);
  await dialog.getByLabel("Commune", { exact: true }).selectOption(commune);
  await dialog
    .getByRole("button", { name: "Confirmer ma localisation" })
    .click();
  await expect(dialog).not.toBeVisible();
}
test("choix, proximité, tout Haïti et persistance sans GPS", async ({
  page,
}) => {
  await page.goto("/boutique");
  await expect(
    page.getByRole("checkbox", { name: "Disponible près de moi", exact: true }),
  ).toBeDisabled();
  await choose(page, "centre", "hinche");
  await expect(page.locator(".filters:visible")).toContainText("Hinche");
  await page
    .getByRole("checkbox", { name: "Disponible près de moi", exact: true })
    .check();
  await page.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await expect(
    page.locator(".catalog-grid .product-card").first(),
  ).toContainText("Sneakers SHENA");
  await expect(page.locator(".catalog-grid")).not.toContainText(
    "Casque sans fil Studio",
  );
  await page.screenshot({
    path: "test-results/shena-catalogue-hinche.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".filters:visible")).toContainText("Hinche");
  await expect(
    page.getByRole("checkbox", { name: "Disponible près de moi", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("link", {
      name: "Voir les produits dans toute Haïti",
      exact: true,
    })
    .click();
  await expect(page.locator(".product-card")).toHaveCount(6);
  await expect(page.locator(".catalog-results")).toContainText("8 produits");
  await choose(page, "sud-est", "jacmel");
  await page
    .getByRole("checkbox", { name: "Disponible près de moi", exact: true })
    .check();
  await page.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(page.locator(".catalog-grid")).toContainText(
    "Mon planner essentiel",
  );
});
test("changer le département efface la commune et les options incompatibles", async ({
  page,
}) => {
  await page.goto("/boutique");
  await choose(page, "centre", "maissade");
  await page.locator(".filters:visible .location-trigger").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Département", { exact: true }).selectOption("nord");
  await expect(dialog.getByLabel("Commune", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("option", { name: "Maïssade" })).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Confirmer ma localisation" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".filters:visible .location-trigger"),
  ).toBeFocused();
});
test("fiches : origines et tarifs inconnus, numérique hors transport", async ({
  page,
}) => {
  await page.goto("/boutique");
  await choose(page, "centre", "hinche");
  await page.goto("/produit/sneakers-shena-demo");
  await expect(page.locator(".availability-panel")).toContainText(
    "Disponible dans votre commune (démo)",
  );
  await expect(page.locator(".inventory-list")).toContainText(
    "6 unités fictives",
  );
  await expect(page.locator(".availability-panel")).toContainText(
    "Livraison et tarif à confirmer",
  );
  await page.getByRole("button", { name: "Autre vue", exact: true }).click();
  await expect(page.locator(".gallery-stage img")).toHaveAttribute(
    "src",
    /studio-alternate/,
  );
  await page.goto("/produit/planner-essentiel");
  await expect(page.locator(".availability-panel")).toContainText(
    "Aucun frais de livraison physique",
  );
  await expect(page.locator(".availability-panel .inventory-list")).toHaveCount(
    0,
  );
  await expect(
    page.locator(".availability-panel .location-trigger"),
  ).toHaveCount(0);
  await page.goto("/mes-achats-numeriques");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Mes achats numériques",
  );
  await expect(page.locator("main")).toContainText(
    "La bibliothèque n’est pas encore disponible",
  );
});
test("sélecteur mobile et captures du choix géographique", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".location-mobile .location-trigger").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Département", { exact: true }).selectOption("nord");
  await dialog
    .getByLabel("Commune", { exact: true })
    .selectOption("cap-haitien");
  await expect(
    dialog.getByRole("button", { name: "Confirmer ma localisation" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/shena-location-mobile.png",
    fullPage: false,
  });
  await dialog
    .getByRole("button", { name: "Confirmer ma localisation" })
    .click();
  await expect(page.locator(".location-mobile")).toContainText("Cap-Haïtien");
  await expect(page.locator(".nearby-section")).toContainText("Cap-Haïtien");
  await expect(page.locator(".nearby-product-list .product-card")).toHaveCount(
    2,
  );
});
test("atelier de stocks : point multiple et rupture restent une simulation", async ({
  page,
}) => {
  await page.goto("/gestion-stocks-demo");
  await page.getByLabel("Nom public du point").fill("Point test");
  await page.getByLabel("Département du point").selectOption("centre");
  await page.getByLabel("Commune du point").selectOption("maissade");
  await page.getByRole("button", { name: "Ajouter à la simulation" }).click();
  await expect(page.locator(".workbench-status")).toContainText(
    "Point fictif ajouté",
  );
  await page
    .getByLabel("Point de stockage")
    .selectOption({ label: "Point test — démo" });
  await page.getByLabel("Quantité fictive").fill("3");
  await page.getByRole("button", { name: "Appliquer à la simulation" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Point test — démo" }),
  ).toContainText("3");
  await page.getByLabel("Quantité fictive").fill("0");
  await page.getByRole("button", { name: "Appliquer à la simulation" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Point test — démo" }),
  ).toContainText("Rupture (démo)");
  await page.screenshot({
    path: "test-results/shena-stocks-demo.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Point test — démo" }),
  ).toHaveCount(0);
});
