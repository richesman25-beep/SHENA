import "server-only";
import { cache } from "react";
import { categories, products } from "../catalog";
import type { CatalogState } from "../catalog-state";
import { publicClient } from "./public";
import { fetchActiveProducts } from "./product-query";
import { adaptProduct } from "../product-adapter";
const liveCategories = [
  ...categories,
  {
    slug: "non-classe",
    name: "Autres produits",
    short: "Autres",
    mark: "06",
    color: "#eaf2ff",
  },
];
export const loadCatalog = cache(async (): Promise<CatalogState> => {
  if (process.env.SHENA_CATALOG_MODE === "demo")
    return {
      mode: "demo",
      status: "ready",
      products,
      categories: [...categories],
    };
  const base = {
    mode: "live" as const,
    products: [],
    categories: liveCategories,
  };
  try {
    const client = publicClient();
    if (!client)
      return {
        ...base,
        status: "unconfigured",
        message:
          "Le catalogue n’est pas encore configuré. Aucun produit de démonstration n’est proposé à la vente.",
      };
    // Le client public ne porte jamais la session admin. Toutes les requêtes filtrent active=true.
    const data = await fetchActiveProducts(client);
    const mapped = data.map(adaptProduct).filter((p) => p !== null);
    const state: CatalogState = { ...base, status: "ready", products: mapped };
    // Les tables supplémentaires ne sont interrogées qu’après annonce explicite du schéma approuvé.
    const features = await client.rpc("shena_catalog_features");
    if (
      !features.error &&
      features.data?.version === 1 &&
      features.data.categories === true
    ) {
      const [cats, links] = await Promise.all([
        client.from("categories").select("id,slug,name").eq("active", true),
        client.from("product_categories").select("product_id,category_id"),
      ]);
      if (!cats.error && !links.error) {
        state.categories = [
          ...liveCategories,
          ...cats.data
            .filter((c) => !liveCategories.some((old) => old.slug === c.slug))
            .map((c) => ({
              slug: c.slug,
              name: c.name,
              short: c.name,
              mark: "",
              color: "#eaf2ff",
            })),
        ];
        for (const p of state.products) {
          const ids = links.data
            .filter((l) => l.product_id === p.id)
            .map((l) => l.category_id);
          const associated = cats.data.filter((c) => ids.includes(c.id));
          if (associated.length) {
            p.category = associated[0].slug;
            p.categoryIds = [
              ...(p.type === "digital" ? ["numerique"] : []),
              ...associated.map((c) => c.slug),
            ];
            p.categoryLabel = associated[0].name;
          }
        }
      } else
        state.message =
          "Produits chargés ; classement par catégories temporairement indisponible.";
    }
    return state;
  } catch {
    return {
      ...base,
      status: "error",
      message:
        "La configuration ou la connexion au catalogue doit être vérifiée.",
    };
  }
});
