import type { ExistingProduct } from "./supabase/config";
import type { Product } from "./catalog";
export function normalizeProductType(value: string): Product["type"] {
  const s = value.trim().toLowerCase();
  if (["digital", "numerique", "numérique"].includes(s)) return "digital";
  if (
    ["stock", "physical", "physical_stock", "physique", "in_stock"].includes(s)
  )
    return "stock";
  if (["preorder", "physical_preorder", "sur_commande"].includes(s))
    return "preorder";
  return "unknown";
}
export function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const u = new URL(value);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.pathname.includes("/storage/v1/object/sign/") &&
      !u.pathname.includes("/storage/v1/object/authenticated/") &&
      !["token", "apikey", "access_token", "signature", "x-amz-signature"].some(
        (key) => u.searchParams.has(key),
      )
    )
      return u.href;
  } catch {}
}
export function adaptProduct(row: ExistingProduct): Product | null {
  if (
    row.price_htg === null ||
    row.price_htg === undefined ||
    String(row.price_htg).trim() === ""
  )
    return null;
  const price = Number(row.price_htg);
  if (
    !row.active ||
    !row.id ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(row.stock ?? 0) ||
    (row.stock ?? 0) < 0
  )
    return null;
  const type = normalizeProductType(row.product_type || "");
  return {
    id: row.id,
    slug: row.id,
    name: row.name,
    description: row.description || "",
    price,
    stock: row.stock ?? 0,
    stockKnown: row.stock !== null,
    type,
    category: type === "digital" ? "numerique" : "non-classe",
    brand: "SHENA",
    image: "",
    imageUrl: safeImageUrl(row.image_url),
    source: "supabase",
    details: [],
    createdAt: row.created_at,
  };
}
