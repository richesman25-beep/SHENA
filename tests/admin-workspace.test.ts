import { test } from "node:test";
import assert from "node:assert/strict";
import {
  productMetrics,
  selectAdminProducts,
  productRevision,
  parseAdminFilters,
} from "../src/lib/admin/products";
import { safeStoragePrefix, managedObjectPath } from "../src/lib/admin/storage";
import {
  trustedSiteOrigin,
  validateNewPassword,
} from "../src/lib/admin/recovery";
import {
  validatePrivateFile,
  validateDigitalMetadata,
} from "../src/lib/admin/digital";
import { parseCapabilities, hasAdminRole } from "../src/lib/admin/policy";
import {
  canTransitionOrder,
  configuredPaymentAdapter,
} from "../src/lib/commerce/contracts";
import type { ExistingProduct } from "../src/lib/supabase/config";
const product: ExistingProduct = {
  id: "b8fdb96d-7800-4d02-9b91-c40e86fe678a",
  created_at: "2026-11-01T12:00:00Z",
  name: "Café haïtien",
  description: "Moulu",
  price_htg: 100,
  product_type: "physical",
  stock: 0,
  image_url: null,
  active: true,
};
test("metrics count only physical stockouts and separate unknown and inactive rows", () => {
  const rows = [
    product,
    { ...product, id: "digital", product_type: "digital", active: false },
    { ...product, id: "unknown", product_type: "nonsense" },
  ];
  assert.deepEqual(productMetrics(rows), {
    total: 3,
    active: 2,
    inactive: 1,
    physical: 1,
    digital: 1,
    outOfStock: 1,
    unknown: 1,
  });
  assert.equal(
    selectAdminProducts(rows, { q: "cafe", stock: "empty" }).total,
    1,
  );
  assert.equal(
    selectAdminProducts(rows, { type: "digital", status: "inactive" }).items[0]
      .id,
    "digital",
  );
});
test("pagination clamps and no filter mutation", () => {
  const rows = Array.from({ length: 32 }, (_, i) => ({
    ...product,
    id: String(i),
  }));
  assert.equal(selectAdminProducts(rows, { page: "999" }).items.length, 2);
  assert.equal(selectAdminProducts(rows, { page: "-1" }).page, 1);
  assert.deepEqual(parseAdminFilters({ q: ["ignored"], status: "active" }), {
    status: "active",
  });
  assert.equal(rows.length, 32);
});
test("revision changes for mutable fields but numeric serialization remains stable", () => {
  assert.equal(
    productRevision(product),
    productRevision({ ...product, price_htg: "100" }),
  );
  for (const change of [
    { stock: 1 },
    { image_url: "https://example.com/a.webp" },
    { active: false },
    { name: "Autre" },
  ])
    assert.notEqual(
      productRevision(product),
      productRevision({ ...product, ...change }),
    );
});
test("storage paths reject traversal and protect legacy files", () => {
  for (const p of ["../secret", "a/../b", "/root", "a\\b", "a/%2e%2e/b"])
    assert.equal(safeStoragePrefix(p), null);
  assert.equal(safeStoragePrefix("managed/abc"), "managed/abc");
  assert.equal(managedObjectPath("old/image.webp"), false);
  const id = product.id;
  assert.equal(managedObjectPath(`managed/${id}/${id}/${id}.webp`), true);
});
test("recovery origin cannot be supplied as a redirect path or arbitrary insecure URL", () => {
  for (const s of [
    "https://shena.test/evil",
    "https://user:pass@shena.test",
    "https://shena.test/?next=x",
    "http://shena.test",
  ])
    assert.equal(trustedSiteOrigin(s), null);
  assert.equal(trustedSiteOrigin("https://shena.test"), "https://shena.test");
  assert.equal(
    validateNewPassword("long unique password", "long unique password"),
    true,
  );
  assert.equal(validateNewPassword("short", "short"), false);
  assert.equal(validateNewPassword("long unique password", "different"), false);
});
test("private file gate checks size signature and capability, never labels clean", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 fixture");
  assert.ok(
    validatePrivateFile(
      { name: "ebook.pdf", type: "application/pdf", size: pdf.length },
      pdf,
      false,
    ),
  );
  assert.equal(
    validatePrivateFile(
      { name: "ebook.pdf", type: "application/pdf", size: 4 },
      new Uint8Array([80, 75, 3, 4]),
      false,
    ),
    null,
  );
  const zip = new Uint8Array([80, 75, 3, 4]);
  const f = { name: "template.zip", type: "application/zip", size: 4 };
  assert.equal(validatePrivateFile(f, zip, false), null);
  assert.ok(validatePrivateFile(f, zip, true));
  assert.equal(
    validatePrivateFile({ ...f, name: "malware.exe" }, zip, true),
    null,
  );
});
test("structured metadata bounds and trusted capability manifests", () => {
  const form = new FormData();
  form.set("kind", "software");
  form.set("formats", "ZIP, PDF");
  assert.deepEqual(validateDigitalMetadata(form).formats, ["ZIP", "PDF"]);
  form.set("license", "a".repeat(5001));
  assert.throws(() => validateDigitalMetadata(form));
  assert.equal(
    parseCapabilities({ version: 1, mediaDelete: true })?.mediaDelete,
    false,
  );
  assert.equal(
    parseCapabilities({ version: 2, mediaDelete: "true" })?.mediaDelete,
    false,
  );
  assert.equal(
    parseCapabilities({ version: 2, digitalMetadata: true })
      ?.extendedDigitalUploads,
    false,
  );
  assert.equal(hasAdminRole({ user_metadata: { shena_role: "admin" } }), false);
});
test("payment remains unavailable and invalid transitions fail closed", () => {
  assert.equal(configuredPaymentAdapter(), null);
  assert.equal(canTransitionOrder("pending_payment", "shipped"), false);
  assert.equal(canTransitionOrder("refunded", "paid"), false);
  assert.equal(canTransitionOrder("paid", "processing"), true);
});

test("admin reader follows a lower server row limit without skipping rows", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { readAdminProducts } = await import("../src/lib/admin/products");
  const source = Array.from({ length: 5 }, (_, i) => ({
    ...product,
    id: String(i),
  }));
  const offsets: number[] = [];
  const client = createClient(
    "https://example.test",
    "sb_publishable_fixture",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input));
          const start = Number(url.searchParams.get("offset") || 0);
          offsets.push(start);
          const page = source.slice(start, start + 2);
          return new Response(JSON.stringify(page), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Content-Range": `${start}-${start + page.length - 1}/${source.length}`,
            },
          });
        },
      },
    },
  );
  assert.deepEqual(
    (await readAdminProducts(client)).map((p) => p.id),
    source.map((p) => p.id),
  );
  assert.deepEqual(offsets, [0, 2, 4]);
});
