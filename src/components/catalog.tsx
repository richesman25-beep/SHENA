"use client";
import { useLocation } from "./location-provider";
import { LocationPicker } from "./location-picker";
import Link from "next/link";
import {
  categories,
  filterProducts,
  products,
  type Filters,
} from "@/lib/catalog";
import { ProductCard } from "./product-card";
export function Catalog({
  filters,
  digital = false,
}: {
  filters: Filters;
  digital?: boolean;
}) {
  const { location } = useLocation();
  const effective = {
    ...filters,
    ...(digital ? { category: "numerique" } : {}),
  };
  const result = filterProducts(effective, products, location);
  function pageLink(page: number) {
    const query = new URLSearchParams();
    Object.entries(effective).forEach(([k, v]) => {
      if (v && k !== "page") query.set(k, v);
    });
    query.set("page", String(page));
    return `${digital ? "/numerique" : "/boutique"}?${query}`;
  }
  return (
    <>
      <form className="filters" action={digital ? "/numerique" : "/boutique"}>
        <div className="filter-title">Affiner votre sélection</div>
        {!digital && (
          <div className="geographic-filter">
            <LocationPicker compact />
            <label className="near-checkbox">
              <input
                type="checkbox"
                name="near"
                value="1"
                defaultChecked={filters.near === "1"}
                disabled={!location}
              />
              Disponible près de moi
            </label>
            {!location && (
              <small>Choisissez une commune pour activer ce filtre.</small>
            )}
            <Link href="/boutique" className="country-filter">
              Voir les produits dans toute Haïti
            </Link>
            <small>Stocks fictifs · Aucune distance routière calculée</small>
          </div>
        )}
        <label>
          Rechercher
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Nom, mot-clé…"
          />
        </label>
        {!digital && (
          <>
            <label>
              Catégorie
              <select name="category" defaultValue={filters.category || ""}>
                <option value="">Toutes les catégories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select name="type" defaultValue={filters.type || ""}>
                <option value="">Tous les types</option>
                <option value="stock">Physique en stock</option>
                <option value="preorder">Sur commande</option>
                <option value="digital">Numérique</option>
              </select>
            </label>
          </>
        )}
        <label>
          Marque
          <select name="brand" defaultValue={filters.brand || ""}>
            <option value="">Toutes les marques</option>
            {[
              ...new Set(
                products
                  .filter((p) => !digital || p.type === "digital")
                  .map((p) => p.brand),
              ),
            ].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <div className="price-inputs">
          <label>
            Prix min.
            <input
              name="min"
              type="number"
              min="0"
              defaultValue={filters.min}
              placeholder="HTG"
            />
          </label>
          <label>
            Prix max.
            <input
              name="max"
              type="number"
              min="0"
              defaultValue={filters.max}
              placeholder="HTG"
            />
          </label>
        </div>
        {!digital && (
          <label>
            Disponibilité
            <select
              name="availability"
              defaultValue={filters.availability || ""}
            >
              <option value="">Toutes</option>
              <option value="stock">En stock</option>
              <option value="preorder">Sur commande</option>
              <option value="digital">Accès numérique</option>
            </select>
          </label>
        )}
        <label>
          Trier par
          <select name="sort" defaultValue={filters.sort || ""}>
            <option value="">
              {location ? "Proximité administrative" : "Pertinence"}
            </option>
            <option value="newest">Nouveautés de démo</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
          </select>
        </label>
        <button className="button" type="submit">
          Appliquer les filtres
        </button>
        <Link className="text-link" href={digital ? "/numerique" : "/boutique"}>
          Réinitialiser
        </Link>
      </form>
      <div className="catalog-results">
        <p className="result-count">
          {result.total} produit{result.total !== 1 ? "s" : ""} de démonstration
        </p>
        {result.items.length ? (
          <div className="product-grid catalog-grid">
            {result.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>Aucun produit pour le moment.</h2>
            <p>Essayez un autre mot-clé ou élargissez vos filtres.</p>
            <Link
              href={digital ? "/numerique" : "/boutique"}
              className="button"
            >
              Voir toute la sélection
            </Link>
          </div>
        )}
        <nav className="pagination" aria-label="Pagination">
          {Array.from({ length: result.pageCount }, (_, i) => i + 1).map(
            (n) => (
              <Link
                href={pageLink(n)}
                key={n}
                aria-current={result.page === n ? "page" : undefined}
              >
                {" "}
                {n}{" "}
              </Link>
            ),
          )}
        </nav>
      </div>
    </>
  );
}
