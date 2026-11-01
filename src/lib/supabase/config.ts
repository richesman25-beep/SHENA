/** Préparation uniquement : ces fonctions ne créent pas de connexion. */
export type ExistingProduct = {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  price_htg: number;
  product_type: string;
  stock: number | null;
  image_url: string | null;
  active: boolean;
};
export const existingProductColumns =
  "id,created_at,name,description,price_htg,product_type,stock,image_url,active" as const;
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (new URL(url).protocol !== "https:")
    throw new Error("Supabase nécessite une URL HTTPS.");
  return { url, key };
}
// Aucun client n’est instancié : connexion, SSR et lecture RLS réservés à la phase 4.
