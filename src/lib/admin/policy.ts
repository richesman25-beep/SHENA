import { normalizeProductType } from "../product-adapter";
export function hasAdminRole(
  user:
    | {
        app_metadata?: Record<string, unknown>;
        user_metadata?: Record<string, unknown>;
      }
    | null
    | undefined,
) {
  return user?.app_metadata?.shena_role === "admin";
}
export type AdminCapabilities = {
  version: 1 | 2;
  mediaManage: boolean;
  categoryLinks: boolean;
  mediaDelete: boolean;
  audit: boolean;
  digitalMetadata: boolean;
  extendedDigitalUploads: boolean;
  products: boolean;
  categories: boolean;
  geography: boolean;
  images: boolean;
  digital: boolean;
};
export function parseCapabilities(value: unknown): AdminCapabilities | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 && v.version !== 2) return null;
  return {
    version: v.version,
    mediaManage: v.version === 2 && v.mediaManage === true,
    categoryLinks: v.version === 2 && v.categoryLinks === true,
    mediaDelete: v.version === 2 && v.mediaDelete === true,
    audit: v.version === 2 && v.audit === true,
    digitalMetadata: v.version === 2 && v.digitalMetadata === true,
    extendedDigitalUploads:
      v.version === 2 && v.extendedDigitalUploads === true,
    products: v.products === true,
    categories: v.categories === true,
    geography: v.geography === true,
    images: v.images === true,
    digital: v.digital === true,
  };
}
export function validateProductForm(form: FormData, existingType?: string) {
  const name = String(form.get("name") || "").trim();
  const description = String(form.get("description") || "").trim();
  const rawPrice = String(form.get("price_htg") || "");
  const price = Number(rawPrice);
  const rawStock = String(form.get("stock") || "");
  const stock = Number(rawStock);
  const product_type = String(form.get("product_type") || "");
  if (
    !name ||
    name.length > 160 ||
    description.length > 15000 ||
    !rawPrice.trim() ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 100000000 ||
    !/^\d+(\.\d{1,2})?$/.test(rawPrice) ||
    !/^\d+$/.test(rawStock) ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    stock > 1000000 ||
    (!["physical", "digital", "preorder"].includes(product_type) &&
      product_type !== existingType)
  )
    throw new Error(
      "Vérifiez nom, type, prix (deux décimales maximum) et stock entier positif ou nul.",
    );
  const active = form.get("active") === "on";
  return {
    name,
    description,
    price_htg: price,
    stock:
      normalizeProductType(product_type) === "digital" ||
      normalizeProductType(product_type) === "preorder"
        ? 0
        : stock,
    product_type,
    active,
  };
}
export const validUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
