import type { SupabaseClient } from "@supabase/supabase-js";
import {
  existingProductColumns,
  type ExistingProduct,
} from "../supabase/config";
import { normalizeProductType } from "../product-adapter";
export async function readAdminProducts(client: SupabaseClient) {
  const rows: ExistingProduct[] = [];
  for (let from = 0; ;) {
    const result = await client
      .from("products")
      .select(existingProductColumns, { count: "exact" })
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, from + 999);
    if (result.error)
      throw new Error("Lecture des produits indisponible ou refusée.");
    const page = (result.data || []) as ExistingProduct[];
    rows.push(...page);
    if (result.count !== null && result.count !== undefined) {
      if (rows.length >= result.count) return rows;
      if (!page.length) throw new Error("Lecture partielle du catalogue.");
    } else if (page.length < 1000) return rows;
    from += page.length;
    if (from >= 49000)
      throw new Error(
        "Le volume du catalogue nécessite une pagination dédiée.",
      );
  }
}
export type AdminProductFilters = {
  q?: string;
  status?: string;
  type?: string;
  stock?: string;
  page?: string;
};
export function selectAdminProducts(
  rows: ExistingProduct[],
  filters: AdminProductFilters,
) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const q = normalize((filters.q || "").trim().slice(0, 160));
  const selected = rows.filter((p) => {
    const type = normalizeProductType(p.product_type || "");
    return (
      (!q || normalize(`${p.name || ""} ${p.description || ""}`).includes(q)) &&
      (!filters.status ||
        (filters.status === "active"
          ? p.active
          : filters.status === "inactive"
            ? !p.active
            : true)) &&
      (!filters.type ||
        (filters.type === "physical"
          ? type === "stock" || type === "preorder"
          : type === filters.type)) &&
      (!filters.stock ||
        filters.stock !== "empty" ||
        (type === "stock" && p.stock === 0))
    );
  });
  const pages = Math.max(1, Math.ceil(selected.length / 15));
  const page = Math.min(
    pages,
    Math.max(1, Math.floor(Number(filters.page) || 1)),
  );
  return {
    items: selected.slice((page - 1) * 15, page * 15),
    total: selected.length,
    page,
    pages,
  };
}
export function productMetrics(rows: ExistingProduct[]) {
  return {
    total: rows.length,
    active: rows.filter((p) => p.active).length,
    inactive: rows.filter((p) => !p.active).length,
    physical: rows.filter((p) =>
      ["stock", "preorder"].includes(
        normalizeProductType(p.product_type || ""),
      ),
    ).length,
    digital: rows.filter(
      (p) => normalizeProductType(p.product_type || "") === "digital",
    ).length,
    outOfStock: rows.filter(
      (p) =>
        normalizeProductType(p.product_type || "") === "stock" && p.stock === 0,
    ).length,
    unknown: rows.filter(
      (p) => normalizeProductType(p.product_type || "") === "unknown",
    ).length,
  };
}
export function productRevision(p: ExistingProduct) {
  return JSON.stringify([
    p.id,
    p.name,
    p.description,
    p.price_htg === null
      ? null
      : Number.isFinite(Number(p.price_htg))
        ? Number(p.price_htg)
        : String(p.price_htg),
    p.product_type,
    p.stock,
    p.image_url,
    p.active,
  ]);
}
export function parseAdminFilters(
  input: Record<string, string | string[] | undefined>,
): AdminProductFilters {
  const result: AdminProductFilters = {};
  for (const key of ["q", "status", "type", "stock", "page"] as const)
    if (typeof input[key] === "string") result[key] = input[key].slice(0, 160);
  return result;
}
