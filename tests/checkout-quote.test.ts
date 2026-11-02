import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateServerQuote,
  parseQuoteRequest,
  priceMinor,
  validateContact,
} from "../src/lib/commerce/quote";
import type { ExistingProduct } from "../src/lib/supabase/config";
const id = "11111111-1111-4111-8111-111111111111",
  zoneId = "22222222-2222-4222-8222-222222222222";
const product: ExistingProduct = {
  id,
  created_at: "2026-01-01T00:00:00Z",
  name: "Fixture",
  description: null,
  price_htg: "0.29",
  stock: 4,
  product_type: "physical",
  image_url: null,
  active: true,
};
test("server quote ignores browser prices paid flags and hidden extra fields", () => {
  const request = parseQuoteRequest({
    lines: [{ id, quantity: 3, price: 0 }],
    paid: true,
    total: 1,
  });
  assert.deepEqual(request, {
    lines: [{ id, quantity: 3 }],
    location: null,
    zoneId: null,
  });
  const quote = calculateServerQuote(request, [product], [], false);
  assert.equal(quote.subtotalMinor, 87);
  assert.equal(quote.deliveryMinor, null);
  assert.equal(quote.totalMinor, null);
  assert.equal(quote.canOrder, false);
});
test("money uses integer minor units and rejects malformed prices", () => {
  assert.equal(priceMinor("12.50"), 1250);
  assert.equal(priceMinor(0.29), 29);
  for (const n of ["NaN", "Infinity", "1.234", "-1", "1e2", null, Infinity])
    assert.throws(() => priceMinor(n));
});
test("duplicate split lines invalid UUID and excessive quantities are rejected", () => {
  for (const lines of [
    [
      { id, quantity: 1 },
      { id, quantity: 1 },
    ],
    [{ id: "demo", quantity: 1 }],
    [{ id, quantity: 1.5 }],
    [{ id, quantity: 101 }],
  ])
    assert.throws(() => parseQuoteRequest({ lines }));
});
test("inactive missing stock preorder and unsupported types fail closed", () => {
  const request = parseQuoteRequest({ lines: [{ id, quantity: 3 }] });
  for (const change of [
    { active: false },
    { active: null },
    { name: null },
    { price_htg: null },
    { product_type: null },
    { stock: 2 },
    { stock: null },
    { product_type: "preorder" },
    { product_type: "unknown" },
  ])
    assert.throws(() =>
      calculateServerQuote(request, [{ ...product, ...change }], [], true),
    );
});
test("delivery fee and destination must come from an active matching zone", () => {
  const request = parseQuoteRequest({
    lines: [{ id, quantity: 1 }],
    location: { departmentId: "centre", communeId: "hinche" },
    zoneId,
  });
  const zone = {
    id: zoneId,
    name: "Fixture uniquement",
    department_id: "centre",
    commune_id: "hinche",
    fee_minor: 25000,
    active: true,
  };
  assert.equal(
    calculateServerQuote(request, [product], [zone], true).totalMinor,
    25029,
  );
  assert.equal(
    calculateServerQuote(request, [product], [zone], true).canOrder,
    true,
  );
  for (const change of [
    { active: false },
    { department_id: "nord" },
    { commune_id: "maissade" },
    { fee_minor: -1 },
  ])
    assert.throws(() =>
      calculateServerQuote(request, [product], [{ ...zone, ...change }], true),
    );
});
test("digital has zero physical shipping but never bypasses ordering gate", () => {
  const request = parseQuoteRequest({ lines: [{ id, quantity: 1 }] });
  const quote = calculateServerQuote(
    request,
    [{ ...product, product_type: "digital", stock: 0 }],
    [],
    false,
  );
  assert.equal(quote.deliveryMinor, 0);
  assert.equal(quote.totalMinor, 29);
  assert.equal(quote.canOrder, false);
  assert.throws(() =>
    calculateServerQuote(
      { ...request, lines: [{ id, quantity: 2 }] },
      [{ ...product, product_type: "digital" }],
      [],
      true,
    ),
  );
});
test("contact validation bounds data without accepting payment fields", () => {
  assert.deepEqual(
    validateContact({
      name: "Client test",
      phone: "+509 1234 5678",
      address: "Staging",
      note: "",
      paid: true,
    }),
    {
      name: "Client test",
      phone: "+509 1234 5678",
      address: "Staging",
      note: "",
    },
  );
  assert.throws(() => validateContact({ name: "A", phone: "no" }));
});
