import test from "node:test";
import assert from "node:assert/strict";
import { filterProducts, products, readFilters } from "../src/lib/catalog";
import { cartTotal, normalizeCart } from "../src/lib/cart";
test("recherche insensible aux accents et à la casse", () => {
  assert.equal(
    filterProducts({ q: "RITUEL DOUCEUR" }).items[0].id,
    "beauty-demo",
  );
  assert.equal(filterProducts({ q: "professionnel" }).total, 1);
});
test("les filtres combinés excluent les produits hors plage ou catégorie", () => {
  const found = filterProducts({
    category: "numerique",
    min: "700",
    max: "1000",
  });
  assert.deepEqual(
    found.items.map((p) => p.id),
    ["template-demo"],
  );
  assert.equal(
    filterProducts({ brand: "Studio", availability: "stock" }).total,
    1,
  );
});
test("tri et pagination produisent un résultat stable", () => {
  const result = filterProducts({ sort: "price-asc" });
  assert.equal(result.items[0].id, "planner-demo");
  assert.equal(result.items.length, 6);
  assert.equal(result.pageCount, 2);
  assert.equal(filterProducts({ page: "2" }).items.length, 2);
  assert.equal(filterProducts({ page: "999" }).page, 2);
  assert.equal(filterProducts({ page: "-2" }).page, 1);
});
test("un résultat vide reste vide", () => {
  assert.equal(filterProducts({ q: "introuvable-xyz" }).total, 0);
});
test("le stockage local non fiable ne définit ni prix ni produit", () => {
  assert.deepEqual(
    normalizeCart([
      { id: "unknown", quantity: 2 },
      { id: "planner-demo", quantity: -1 },
      { id: "beauty-demo", quantity: 2.5 },
      null,
    ]),
    [],
  );
  assert.equal(
    cartTotal([{ id: "planner-demo", quantity: 1, price: 1 } as never]),
    650,
  );
  assert.deepEqual(normalizeCart("invalide"), []);
});
test("les quantités respectent le stock, une licence numérique et les doublons", () => {
  assert.deepEqual(
    normalizeCart([
      { id: "headphones-demo", quantity: 999 },
      { id: "planner-demo", quantity: 7 },
      { id: "headphones-demo", quantity: 2 },
    ]),
    [
      { id: "headphones-demo", quantity: 8 },
      { id: "planner-demo", quantity: 1 },
    ],
  );
});
test("un panier mixte calcule le total depuis le catalogue", () => {
  assert.equal(
    cartTotal([
      { id: "beauty-demo", quantity: 2 },
      { id: "planner-demo", quantity: 1 },
    ]),
    5150,
  );
  assert.equal(cartTotal([]), 0);
});
test("les produits ont des identifiants et routes uniques", () => {
  assert.equal(new Set(products.map((p) => p.id)).size, products.length);
  assert.equal(new Set(products.map((p) => p.slug)).size, products.length);
});

test("paramètres répétés ou inconnus ignorés sans erreur serveur", () => {
  assert.deepEqual(
    readFilters({ q: ["a", "b"], category: "mode", unknown: "x" }),
    { category: "mode" },
  );
});
