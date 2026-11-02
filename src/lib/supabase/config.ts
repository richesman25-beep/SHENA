import { assertPreviewIsolation } from "./deployment";
export type ExistingProduct = {
  id: string;
  created_at: string;
  name: string | null;
  description: string | null;
  price_htg: number | string | null;
  product_type: string | null;
  stock: number | null;
  image_url: string | null;
  active: boolean | null;
};
export const existingProductColumns =
  "id,created_at,name,description,price_htg,product_type,stock,image_url,active" as const;
export function validateSupabaseConfig(
  url: string | undefined,
  key: string | undefined,
) {
  if (!url || !key) return null;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error("URL Supabase HTTPS invalide.");
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "Une clé secrète ne peut pas être utilisée comme clé publique.",
    );
  if (!key.startsWith("sb_publishable_")) {
    let role: string | undefined;
    try {
      role = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ).role;
    } catch {
      throw new Error("Clé publique Supabase invalide.");
    }
    if (role !== "anon")
      throw new Error(
        "Utiliser la clé publishable ou l’ancienne clé anon, jamais service_role.",
      );
  }
  return { url: parsed.origin, key };
}
export function getSupabaseConfig() {
  const config = validateSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (config) assertPreviewIsolation(config.url, process.env);
  return config;
}
