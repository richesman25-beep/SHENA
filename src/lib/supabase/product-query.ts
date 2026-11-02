import type { SupabaseClient } from "@supabase/supabase-js";
import { existingProductColumns, type ExistingProduct } from "./config";
/** Contrat testé avec le SDK réel et un transport HTTP simulé, sans base distante. */
export async function fetchActiveProducts(client: SupabaseClient) {
  const rows: ExistingProduct[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await client
      .from("products")
      .select(existingProductColumns)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (result.error) throw new Error("Lecture catalogue refusée.");
    const batch = (result.data || []) as ExistingProduct[];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
    if (from >= 49000) throw new Error("Pagination serveur à adapter.");
  }
}
