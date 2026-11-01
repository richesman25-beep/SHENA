import { CatalogStatus } from "@/components/catalog-status";
import { loadCatalog } from "@/lib/supabase/catalog";
import { VariantSelection } from "@/components/variant-selection";
import { ProductAvailability } from "@/components/product-availability";
import { ProductGallery } from "@/components/product-gallery";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categories, money, typeLabel } from "@/lib/catalog";
import { Purchase } from "@/components/purchase";
import { ProductCard } from "@/components/product-card";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { products, status } = await loadCatalog();
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  return {
    title:
      status !== "ready"
        ? "Catalogue indisponible"
        : product?.name || "Produit introuvable",
    description: product?.description,
  };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { products, status } = await loadCatalog();
  const { slug } = await params;
  if (status !== "ready")
    return (
      <div className="shell">
        <CatalogStatus />
      </div>
    );
  const p = products.find((p) => p.slug === slug);
  if (!p) notFound();
  const category = categories.find((c) => c.slug === p.category) || {
    name: p.categoryLabel || "Autres produits",
  };
  return (
    <div className="shell">
      <nav className="breadcrumb" aria-label="Fil d’Ariane">
        <Link href="/boutique">Boutique</Link>
        <span>/</span>
        <Link
          href={
            p.type === "digital"
              ? "/numerique"
              : `/boutique?category=${p.category}`
          }
        >
          {category.name}
        </Link>
        <span>/</span>
        <span>{p.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery
          image={p.image}
          name={p.name}
          url={p.imageUrl}
          live={p.source === "supabase"}
        />
        <div className="detail-copy">
          <span className={`badge static ${p.type}`}>
            {p.type === "stock"
              ? p.source === "supabase"
                ? "Stock global"
                : "Stock de démonstration"
              : typeLabel(p.type)}
          </span>
          <p className="eyebrow">
            {p.brand || "Vendu par SHENA"} / {category.name}
          </p>
          <h1>{p.name}</h1>
          <p className="detail-price">{money(p.price)}</p>
          <p>{p.description}</p>
          <ul className="detail-list">
            {p.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {p.type === "stock" && (
            <p className="stock-note">
              {p.stock}{" "}
              {p.source === "supabase"
                ? "unités en stock global"
                : "unités fictives disponibles · stock de démonstration"}
            </p>
          )}
          {p.lead && (
            <p className="info-box">
              {p.lead}. Aucun approvisionnement ne sera déclenché.
            </p>
          )}
          {p.type === "digital" && (
            <dl className="digital-specs">
              <div>
                <dt>Format</dt>
                <dd>{p.formats || "Non renseigné"}</dd>
              </div>
              <div>
                <dt>Taille</dt>
                <dd>{p.size || "Non renseignée"}</dd>
              </div>
              <div>
                <dt>Licence</dt>
                <dd>
                  {p.license ||
                    "Conditions à renseigner avant commercialisation"}
                </dd>
              </div>
              <div>
                <dt>Accès</dt>
                <dd>
                  Aucun fichier complet exposé. La livraison sécurisée après
                  paiement sera développée ultérieurement.
                </dd>
              </div>
            </dl>
          )}
          {!p.source && <VariantSelection image={p.image} />}
          <ProductAvailability product={p} detail />
          <Purchase product={p} />
          <details>
            <summary>
              {p.type === "digital"
                ? "Licence & modalités numériques"
                : "Livraison & retours"}
            </summary>
            <p>
              {p.type === "digital"
                ? "Aperçu illustré uniquement. Compatibilité précisée dans la description. Durée d’accès et éventuelles limites seront affichées avant toute vente."
                : "Livraison prévue en Haïti. Zones, tarifs, délais et conditions de retour restent à valider avant ouverture des ventes."}
            </p>
            <Link
              className="text-link"
              href={`/informations/${p.type === "digital" ? "numerique" : "livraison"}`}
            >
              En savoir plus
            </Link>
          </details>
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <h2>À découvrir aussi.</h2>
        </div>
        <div className="product-grid">
          {products
            .filter(
              (other) =>
                other.id !== p.id &&
                (other.category === p.category || other.type === p.type),
            )
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
    </div>
  );
}
