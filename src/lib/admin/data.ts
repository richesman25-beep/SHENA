import "server-only";
import { cache } from "react";
import { adminView } from "./auth";
import { readAdminProducts } from "./products";
export const adminProductData = cache(async () => {
  const context = await adminView();
  if (!context) return null;
  try {
    return {
      context,
      products: await readAdminProducts(context.client),
      error: null,
    };
  } catch {
    return {
      context,
      products: [],
      error:
        "Les produits ne peuvent pas être chargés. Vérifiez la connexion et les autorisations Supabase.",
    };
  }
});
