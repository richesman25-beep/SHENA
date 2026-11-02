import Image from "next/image";
import Link from "next/link";
import { adminProductData } from "@/lib/admin/data";
import { selectAdminProducts, parseAdminFilters } from "@/lib/admin/products";
import { money } from "@/lib/catalog";
import { safeImageUrl, normalizeProductType } from "@/lib/product-adapter";
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await adminProductData();
  if (!data) return null;
  const filters = parseAdminFilters(await searchParams);
  const result = selectAdminProducts(data.products, filters);
  function link(page: number) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== "page") query.set(key, value);
    });
    query.set("page", String(page));
    return "/admin/products?" + query;
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">VOTRE CATALOGUE</span>
          <h1>Produits</h1>
          <p>
            Gérez les articles physiques et les ressources numériques de SHENA.
          </p>
        </div>
        <Link className="button" href="/admin/products/new">
          + Ajouter un produit
        </Link>
      </div>
      <section className="workspace-panel products-panel">
        <form className="admin-product-filters" action="/admin/products">
          <label>
            Rechercher
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Nom ou description du produit"
            />
          </label>
          <label>
            Publication
            <select name="status" defaultValue={filters.status || ""}>
              <option value="">Tous les statuts</option>
              <option value="active">Publiés</option>
              <option value="inactive">Non publiés</option>
            </select>
          </label>
          <label>
            Type
            <select name="type" defaultValue={filters.type || ""}>
              <option value="">Tous les types</option>
              <option value="physical">Physiques</option>
              <option value="digital">Numériques</option>
              <option value="unknown">Type à vérifier</option>
            </select>
          </label>
          <label>
            Disponibilité
            <select name="stock" defaultValue={filters.stock || ""}>
              <option value="">Tous les stocks</option>
              <option value="empty">En rupture</option>
            </select>
          </label>
          <button className="button">Filtrer</button>
          <Link href="/admin/products">Réinitialiser</Link>
        </form>
        {data.error ? (
          <p role="alert" className="admin-error">
            {data.error}
          </p>
        ) : (
          <>
            <div className="admin-list-summary">
              <span>
                {result.total} produit{result.total !== 1 ? "s" : ""} accessible
                {result.total !== 1 ? "s" : ""}
              </span>
              <small>
                Seules les lignes autorisées par Supabase sont affichées.
              </small>
            </div>
            {result.items.length ? (
              <>
                <div className="table-scroll">
                  <table className="admin-products-table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Type</th>
                        <th>Prix</th>
                        <th>Stock global</th>
                        <th>Publication</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((p) => {
                        const image = safeImageUrl(p.image_url);
                        const type = normalizeProductType(p.product_type || "");
                        return (
                          <tr key={p.id}>
                            <td>
                              <Link
                                className="admin-product-title"
                                href={`/admin/products/${p.id}`}
                              >
                                <span className="admin-thumbnail">
                                  {image ? (
                                    <Image
                                      src={image}
                                      alt=""
                                      width={48}
                                      height={48}
                                      unoptimized
                                    />
                                  ) : (
                                    <span>◇</span>
                                  )}
                                </span>
                                <span>
                                  <strong>{p.name}</strong>
                                  <small>{p.id.slice(0, 8)}</small>
                                </span>
                              </Link>
                            </td>
                            <td>
                              <span className={`product-kind ${type}`}>
                                {type === "digital"
                                  ? "Numérique"
                                  : type === "preorder"
                                    ? "Sur commande"
                                    : type === "stock"
                                      ? "Physique"
                                      : "À vérifier"}
                              </span>
                            </td>
                            <td>
                              <strong>
                                {p.price_htg === null
                                  ? "Non renseigné"
                                  : money(Number(p.price_htg))}
                              </strong>
                            </td>
                            <td>
                              {type === "digital"
                                ? "Non applicable"
                                : (p.stock ?? "Non renseigné")}
                            </td>
                            <td>
                              <span
                                className={`publication-status ${p.active ? "published" : ""}`}
                              >
                                {p.active ? "Publié" : "Non publié"}
                              </span>
                            </td>
                            <td>
                              <div className="admin-row-actions">
                                <Link href={`/admin/products/${p.id}`}>
                                  Modifier
                                </Link>
                                {p.active && (
                                  <Link
                                    href={`/produit/${p.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Voir ↗
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <nav
                  className="admin-pagination"
                  aria-label="Pagination produits"
                >
                  <span>
                    Page {result.page} sur {result.pages}
                  </span>
                  {result.page > 1 && (
                    <Link href={link(result.page - 1)}>← Précédent</Link>
                  )}
                  {result.page < result.pages && (
                    <Link href={link(result.page + 1)}>Suivant →</Link>
                  )}
                </nav>
              </>
            ) : (
              <div className="admin-empty">
                <h3>Aucun produit dans cette sélection.</h3>
                <p>Élargissez vos filtres ou vérifiez les droits de lecture.</p>
                <Link href="/admin/products">
                  Afficher tous les produits accessibles
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
