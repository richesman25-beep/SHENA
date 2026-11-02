import test from "node:test";
import assert from "node:assert/strict";
import { departments, communes, normalizeLocation } from "../src/lib/geography";
import { products, filterProducts } from "../src/lib/catalog";
import {
  inventories,
  availableInventory,
  geographicRank,
  deliveryOptions,
  previewAllocations,
} from "../src/lib/logistics";
const hinche = { departmentId: "centre", communeId: "hinche" };
const maissade = { departmentId: "centre", communeId: "maissade" };
const sneakers = products.find((p) => p.id === "sneakers-demo")!;
const digital = products.find((p) => p.id === "planner-demo")!;
test("dix départements et communes cohérentes sans quartier inventé", () => {
  assert.equal(departments.length, 10);
  assert.equal(new Set(communes.map((c) => c.id)).size, communes.length);
  assert.ok(
    communes.every((c) => departments.some((d) => d.id === c.departmentId)),
  );
});
test("localisation non fiable : valider le couple commune-département", () => {
  assert.equal(
    normalizeLocation({ departmentId: "nord", communeId: "hinche" }),
    null,
  );
  assert.equal(normalizeLocation("hinche"), null);
  assert.deepEqual(normalizeLocation(hinche), hinche);
});
test("la proximité est administrative : commune puis département puis autres villes", () => {
  assert.equal(geographicRank(sneakers, hinche), 0);
  assert.equal(geographicRank(sneakers, maissade), 1);
  assert.equal(geographicRank(products[1], hinche), 2);
  assert.equal(geographicRank(digital, hinche), 3);
});
test("filtre proche : seulement stock dans la commune et numérique sans transport", () => {
  const found = filterProducts({ near: "1" }, products, maissade);
  assert.deepEqual(
    new Set(found.items.map((p) => p.id)),
    new Set(["beauty-demo", "planner-demo", "template-demo"]),
  );
  assert.equal(
    filterProducts({ near: "1", type: "stock" }, products, {
      departmentId: "sud-est",
      communeId: "jacmel",
    }).total,
    0,
  );
});
test("toute Haïti conserve les autres villes, commandes et numériques", () => {
  const result = filterProducts({}, products, hinche);
  assert.equal(result.total, 8);
  assert.equal(result.items[0].id, "sneakers-demo");
  assert.ok(
    result.items.findIndex((p) => p.id === "beauty-demo") <
      result.items.findIndex((p) => p.id === "headphones-demo"),
  );
});
test("prix explicite garde son tri avec la géographie et la pagination", () => {
  const result = filterProducts({ sort: "price-asc" }, products, hinche);
  assert.equal(result.items[0].id, "planner-demo");
  assert.equal(filterProducts({ page: "2" }, products, hinche).items.length, 2);
});
test("une ligne à zéro ne crée pas de disponibilité", () => {
  assert.equal(availableInventory("home-demo").length, 1);
  assert.equal(geographicRank(sneakers, hinche, []), 5);
});
test("les répartitions géographiques correspondent au stock global fictif", () => {
  for (const product of products.filter((p) => p.type === "stock"))
    assert.equal(
      inventories
        .filter((i) => i.productId === product.id)
        .reduce((s, i) => s + i.quantity, 0),
      product.stock,
    );
  assert.equal(availableInventory(digital.id).length, 0);
});
test("aucune règle : ni prix ni délai inventé ; digital exclut le transport", () => {
  assert.equal(
    deliveryOptions(sneakers, hinche).message,
    "Livraison et tarif à confirmer",
  );
  assert.deepEqual(deliveryOptions(sneakers, hinche).rules, []);
  assert.equal(deliveryOptions(digital, hinche).kind, "digital");
  assert.equal(deliveryOptions(digital, hinche).rules.length, 0);
});
test("une règle désactivée ou d’une autre destination ne devient pas livrable", () => {
  const rule = {
    id: "demo",
    originLocationId: "hinche-demo",
    destinationCommuneId: "hinche",
    mode: "local" as const,
    feeHtg: null,
    estimatedLabel: null,
    enabled: false,
  };
  assert.equal(deliveryOptions(sneakers, hinche, [rule]).rules.length, 0);
  assert.equal(
    deliveryOptions(sneakers, { departmentId: "sud", communeId: "les-cayes" }, [
      { ...rule, enabled: true },
    ]).rules.length,
    0,
  );
});
test("allocation multiville : aucun double compte, origine proche prioritaire", () => {
  const plan = previewAllocations(
    [{ id: sneakers.id, quantity: 9 }],
    hinche,
  )[0];
  assert.equal(plan.parcels[0].locationId, "hinche-demo");
  assert.equal(plan.parcels[0].quantity, 6);
  assert.equal(
    plan.parcels.reduce((s, p) => s + p.quantity, 0),
    9,
  );
  assert.equal(plan.unallocated, 0);
  assert.equal(
    previewAllocations([{ id: sneakers.id, quantity: 99 }], hinche)[0]
      .unallocated,
    87,
  );
});
