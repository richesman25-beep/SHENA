import { test, expect } from "@playwright/test";
test("rechercher, filtrer et ouvrir une fiche", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Plus près de vous.",
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
    "Administration indisponible",
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
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "/",
      "/boutique",
      "/numerique",
      "/produit/planner-essentiel",
      "/panier",
      "/mes-achats-numeriques",
      "/gestion-stocks-demo",
      "/produit/casque-sans-fil",
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
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
  await page.goto("/numerique");
  await page.screenshot({
    path: "test-results/shena-digital-desktop.png",
    fullPage: true,
  });
  await page.goto("/produit/casque-sans-fil");
  await page.screenshot({
    path: "test-results/shena-product-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("header marchand et ajout direct depuis une carte", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Mon compte Bientôt disponible" }),
  ).toBeDisabled();
  await page.getByLabel("Catégorie de recherche").selectOption("numerique");
  await page.getByRole("button", { name: "Lancer la recherche" }).click();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Ajouter Mon planner essentiel au panier démo",
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Panier, 1 articles" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Panier, 1 articles" }).click();
  await expect(page.locator(".cart-line")).toContainText(
    "Mon planner essentiel",
  );
  await expect(page.locator(".cart-summary")).toContainText("Non applicable");
});

test("galerie, visuels chargés et liens internes", async ({
  page,
  request,
}) => {
  await page.goto("/produit/casque-sans-fil");
  await page.getByRole("button", { name: "Vue rapprochée" }).click();
  await expect(
    page.getByRole("button", { name: "Vue rapprochée" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gallery-stage")).toHaveClass(/is-zoomed/);
  await expect(page.locator(".gallery-stage img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".gallery-stage img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const links = new Set<string>();
  for (const path of [
    "/",
    "/boutique",
    "/numerique",
    "/produit/planner-essentiel",
  ]) {
    await page.goto(path);
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")!));
    hrefs.forEach((h) => links.add(h));
  }
  for (const href of links) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

test("ancien panier démo conservé sans mélanger les identifiants réels", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("shena.cart.v1.demo"))
      localStorage.setItem(
        "shena.cart.v1",
        JSON.stringify([{ id: "planner-demo", quantity: 1 }]),
      );
  });
  await page.goto("/panier");
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await expect(page.locator(".cart-line")).toContainText(
    "Mon planner essentiel",
  );
  await expect(page.locator(".cart-summary")).toContainText("650 HTG");
});
