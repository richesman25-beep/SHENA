import { test, expect } from "@playwright/test";
test("rechercher, filtrer et ouvrir une fiche", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Votre SHENA",
  );
  await page.getByLabel("Rechercher un produit").fill("casque");
  await page.getByRole("button", { name: "Lancer la recherche" }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("heading", { name: "Casque sans fil Studio" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Casque sans fil Studio",
  );
  await page.goto("/boutique?category=numerique&min=700");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText(
    "Le kit CV professionnel",
  );
  await page.goto("/boutique?q=inexistant123");
  await expect(
    page.getByRole("heading", { name: "Aucun produit pour le moment." }),
  ).toBeVisible();
});
test("panier mixte, modification, persistance et suppression", async ({
  page,
}) => {
  await page.goto("/produit/rituel-douceur");
  await page.getByRole("button", { name: "Ajouter au panier démo" }).click();
  await page.goto("/produit/planner-essentiel");
  await page.getByRole("button", { name: "Ajouter au panier démo" }).click();
  await page.goto("/panier");
  await expect(page.locator(".cart-line")).toHaveCount(2);
  await expect(page.locator(".cart-summary")).toContainText("2 900 HTG");
  await page
    .getByRole("spinbutton", { name: "Quantité pour Rituel douceur" })
    .fill("2");
  await expect(page.locator(".cart-summary")).toContainText("5 150 HTG");
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Quantité pour Rituel douceur" }),
  ).toHaveValue("2");
  await page.getByRole("button", { name: "Retirer Rituel douceur" }).click();
  await expect(page.locator(".cart-summary")).toContainText("Non applicable");
  await expect(
    page.getByRole("button", { name: "Commandes bientôt disponibles" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retirer Mon planner essentiel" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Votre panier attend vos découvertes." }),
  ).toBeVisible();
});
test("numérique, confidentialité et routes non implémentées", async ({
  page,
}) => {
  await page.goto("/numerique");
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.getByRole("heading", { name: "Mon planner essentiel" }).click();
  await expect(page.locator(".digital-specs")).toContainText(
    "Aucun fichier complet exposé",
  );
  await expect(page.locator("a[download]")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Cette page reste à découvrir",
  );
  await page.goto("/informations/confidentialite");
  await expect(page.locator("main")).toContainText("stockage local");
});
test("mobile sans débordement et parcours clavier", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  for (const path of [
    "/",
    "/boutique",
    "/numerique",
    "/produit/planner-essentiel",
    "/panier",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: "test-results/shena-mobile.png",
    fullPage: true,
  });
});
test("capture bureau et erreurs navigateur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/shena-desktop.png",
    fullPage: true,
  });
  await expect(page.locator("footer")).toBeVisible();
  expect(errors).toEqual([]);
});
