import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAdminRole,
  parseCapabilities,
  validateProductForm,
} from "../src/lib/admin/policy";
import {
  adaptProduct,
  normalizeProductType,
  safeImageUrl,
} from "../src/lib/product-adapter";
import { validateSupabaseConfig } from "../src/lib/supabase/config";
import { normalizeCart, cartTotal } from "../src/lib/cart";
const record = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-01-01T00:00:00Z",
  name: "Produit de test contractuel",
  description: "Test uniquement",
  price_htg: "1250.50",
  product_type: "physical",
  stock: 3,
  image_url: null,
  active: true,
};
test("le rôle client ou user_metadata ne donne aucun droit admin", () => {
  assert.equal(hasAdminRole(null), false);
  assert.equal(hasAdminRole({ user_metadata: { shena_role: "admin" } }), false);
  assert.equal(hasAdminRole({ app_metadata: { shena_role: "client" } }), false);
  assert.equal(hasAdminRole({ app_metadata: { shena_role: "admin" } }), true);
});
test("capacités absentes, ancienne version ou valeurs truthy ne donnent pas droit d’écriture", () => {
  assert.equal(parseCapabilities(null), null);
  assert.equal(parseCapabilities({ version: 0, products: true }), null);
  assert.equal(
    parseCapabilities({ version: 1, products: "true" })?.products,
    false,
  );
});
test("adaptation des colonnes existantes sans stock géographique ni catégorie inventés", () => {
  const p = adaptProduct(record)!;
  assert.equal(p.price, 1250.5);
  assert.equal(p.source, "supabase");
  assert.equal(p.slug, record.id);
  assert.equal(p.category, "non-classe");
  assert.equal(p.imageUrl, undefined);
});
test("aucun produit inactif ni prix invalide dans le catalogue public", () => {
  assert.equal(adaptProduct({ ...record, active: false }), null);
  assert.equal(adaptProduct({ ...record, price_htg: -1 }), null);
  assert.equal(adaptProduct({ ...record, price_htg: "NaN" }), null);
  assert.equal(adaptProduct({ ...record, stock: -3 }), null);
});
test("type non reconnu n’est pas inventé ; stock NULL est signalé inconnu", () => {
  assert.equal(normalizeProductType("type-inconnu"), "unknown");
  assert.equal(adaptProduct({ ...record, stock: null })?.stockKnown, false);
  assert.equal(
    adaptProduct({ ...record, product_type: "digital" })?.category,
    "numerique",
  );
});
test("les images refusent les protocoles exécutables et les identifiants dans URL", () => {
  assert.equal(safeImageUrl("javascript:alert(1)"), undefined);
  assert.equal(
    safeImageUrl("https://user:password@example.org/image"),
    undefined,
  );
  assert.equal(
    safeImageUrl("https://example.org/image.webp"),
    "https://example.org/image.webp",
  );
});
test("panier réel utilise le catalogue fourni, jamais les prix ou identifiants des fixtures", () => {
  const product = adaptProduct(record)!;
  assert.equal(cartTotal([{ id: record.id, quantity: 2 }], [product]), 2501);
  assert.deepEqual(
    normalizeCart([{ id: "planner-demo", quantity: 1 }], [product]),
    [],
  );
  assert.deepEqual(
    normalizeCart([{ id: record.id, quantity: 99 }], [product]),
    [{ id: record.id, quantity: 3 }],
  );
});
test("configuration manquante et clé service sont refusées", () => {
  assert.equal(validateSupabaseConfig(undefined, undefined), null);
  assert.throws(() =>
    validateSupabaseConfig("https://example.org", "sb_secret_test-only"),
  );
  assert.throws(() =>
    validateSupabaseConfig("http://example.org", "sb_publishable_test-only"),
  );
});
test("prix et quantités malformés sont refusés par la validation serveur", () => {
  const data = new FormData();
  data.set("name", "Produit test");
  data.set("product_type", "physical");
  data.set("stock", "2");
  data.set("price_htg", "2.345");
  assert.throws(() => validateProductForm(data));
  data.set("price_htg", "2.50");
  data.set("stock", "-1");
  assert.throws(() => validateProductForm(data));
  data.set("stock", "2");
  assert.equal(validateProductForm(data).price_htg, 2.5);
});
test("le numérique ne reçoit pas de stock physique et le type existant peut être préservé", () => {
  const data = new FormData();
  for (const [k, v] of Object.entries({
    name: "PDF test",
    product_type: "digital",
    price_htg: "50",
    stock: "10",
  }))
    data.set(k, v);
  assert.equal(validateProductForm(data).stock, 0);
  data.set("product_type", "stock");
  assert.throws(() => validateProductForm(data));
  assert.equal(validateProductForm(data, "stock").product_type, "stock");
});

test("requête publique du SDK : seules les colonnes connues et active=true, aucun token utilisateur", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { fetchActiveProducts } =
    await import("../src/lib/supabase/product-query");
  const urls: string[] = [];
  const client = createClient(
    "https://supabase-contract.example",
    "sb_publishable_contract-fixture",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          urls.push(String(input));
          return new Response(JSON.stringify([record]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
  );
  const result = await fetchActiveProducts(client);
  assert.equal(result.length, 1);
  const url = new URL(urls[0]);
  assert.equal(url.searchParams.get("active"), "eq.true");
  assert.equal(
    url.searchParams.get("select"),
    "id,created_at,name,description,price_htg,product_type,stock,image_url,active",
  );
  assert.equal(url.searchParams.get("limit"), "1000");
});
test("refus HTTP ne déclenche aucun remplacement par les produits de démonstration", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { fetchActiveProducts } =
    await import("../src/lib/supabase/product-query");
  const client = createClient(
    "https://supabase-contract.example",
    "sb_publishable_contract-fixture",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async () =>
          new Response(JSON.stringify({ message: "denied" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          }),
      },
    },
  );
  await assert.rejects(fetchActiveProducts(client));
});

test("un lien signé de stockage privé ne devient pas un visuel public", () => {
  assert.equal(
    safeImageUrl(
      "https://example.org/storage/v1/object/sign/paid/book.pdf?token=test",
    ),
    undefined,
  );
});
test("image falsifiée SVG refusée avant décodage et image valide réencodée sans métadonnées", async () => {
  const { processProductImage, hasAllowedImageSignature } =
    await import("../src/lib/admin/media");
  const sharp = (await import("sharp")).default;
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal(hasAllowedImageSignature(svg), false);
  await assert.rejects(processProductImage(svg));
  const original = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#183b8c" },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const image = await processProductImage(original);
  const meta = await sharp(image).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 32);
  assert.equal(meta.exif, undefined);
});
