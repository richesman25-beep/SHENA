import Link from "next/link";
import { adminCommerceMetrics } from "@/lib/commerce/server";
import { money } from "@/lib/catalog";
import { adminProductData } from "@/lib/admin/data";
import { productMetrics } from "@/lib/admin/products";
import { Icon } from "@/components/icons";
export default async function Dashboard() {
  const [data, commerce] = await Promise.all([
    adminProductData(),
    adminCommerceMetrics(),
  ]);
  if (!data) return null;
  const metrics = productMetrics(data.products);
  const cards = [
    { label: "Produits accessibles", value: metrics.total, icon: "box" },
    { label: "Publiés", value: metrics.active, icon: "check" },
    { label: "Non publiés", value: metrics.inactive, icon: "layers" },
    { label: "En rupture", value: metrics.outOfStock, icon: "bag" },
  ] as const;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">UNE VUE CLAIRE SUR VOTRE ACTIVITÉ</span>
          <h1>Tableau de bord</h1>
          <p>
            Vos produits réels, vos disponibilités et vos prochaines actions.
          </p>
        </div>
        <Link href="/admin/products/new" className="button">
          + Ajouter un produit
        </Link>
      </div>
      {data.error ? (
        <div role="alert" className="admin-error">
          {data.error}
        </div>
      ) : (
        <>
          <div className="admin-metric-grid">
            {cards.map((c) => (
              <article className="admin-metric" key={c.label}>
                <div>
                  <span>{c.label}</span>
                  <Icon name={c.icon} />
                </div>
                <strong>{c.value}</strong>
                <small>
                  {c.label === "En rupture"
                    ? "Physiques en stock à quantité zéro"
                    : "Données autorisées par Supabase"}
                </small>
              </article>
            ))}
          </div>
          <div className="dashboard-composition">
            <section className="workspace-panel">
              <div className="panel-heading">
                <h2>Votre catalogue</h2>
                <Link href="/admin/products">Tout voir →</Link>
              </div>
              <div className="catalog-breakdown">
                <div>
                  <span className="metric-symbol physical">
                    <Icon name="box" />
                  </span>
                  <p>
                    Produits physiques
                    <small>Articles en stock ou sur commande</small>
                  </p>
                  <strong>{metrics.physical}</strong>
                </div>
                <div>
                  <span className="metric-symbol digital">
                    <Icon name="download" />
                  </span>
                  <p>
                    Produits numériques
                    <small>Ressources et fichiers autorisés</small>
                  </p>
                  <strong>{metrics.digital}</strong>
                </div>
              </div>
              {metrics.unknown > 0 && (
                <p className="admin-inline-notice">
                  {metrics.unknown} produit(s) avec un type à vérifier.
                </p>
              )}
              <div className="catalog-coverage">
                <Icon name="shield" />
                <p>
                  Ces chiffres portent sur les produits lisibles par votre
                  compte. Aucun chiffre de vente n’est estimé.
                </p>
              </div>
            </section>
            <section className="workspace-panel commerce-pending">
              <span className="eyebrow">PROCHAINE ÉTAPE</span>
              <h2>Commandes & revenus</h2>
              {commerce ? (
                "error" in commerce ? (
                  <p className="admin-error" role="alert">
                    {commerce.error}
                  </p>
                ) : (
                  <>
                    <strong>{commerce.orderCount}</strong>
                    <p>
                      {commerce.pendingCount} en attente de paiement.
                      <br />
                      Revenus contrôlés :{" "}
                      {money(commerce.verifiedRevenueMinor / 100)}
                    </p>
                    <small>
                      Uniquement les paiements enregistrés comme approuvés par
                      deux administrateurs distincts.
                    </small>
                  </>
                )
              ) : (
                <>
                  <strong>—</strong>
                  <p>
                    Les commandes et paiements ne sont pas activés. Les revenus
                    apparaîtront uniquement à partir de transactions vérifiées.
                  </p>
                </>
              )}
              <Link href="/admin/commandes">Voir les prérequis →</Link>
            </section>
          </div>
          <section className="workspace-panel">
            <div className="panel-heading">
              <div>
                <h2>Activité récente</h2>
                <p>Derniers produits créés dans votre catalogue accessible.</p>
              </div>
              <Link href="/admin/products">Voir les produits →</Link>
            </div>
            {data.products.length ? (
              <div className="recent-products">
                {data.products.slice(0, 5).map((p) => (
                  <Link href={`/admin/products/${p.id}`} key={p.id}>
                    <span className="recent-product-icon">
                      <Icon name="box" />
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        Création enregistrée{" "}
                        {p.created_at &&
                        Number.isFinite(Date.parse(p.created_at))
                          ? new Intl.DateTimeFormat("fr-HT", {
                              dateStyle: "medium",
                              timeZone: "America/Port-au-Prince",
                            }).format(new Date(p.created_at))
                          : "— date non renseignée"}
                      </small>
                    </div>
                    <span
                      className={`publication-status ${p.active ? "published" : ""}`}
                    >
                      {p.active ? "Publié" : "Non publié"}
                    </span>
                    <Icon name="arrow" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="admin-empty">
                <Icon name="box" />
                <h3>Votre catalogue attend ses premiers produits.</h3>
                <p>
                  Aucun produit n’est accessible à ce compte. Vérifiez les
                  permissions si des produits existent déjà.
                </p>
                <Link className="button" href="/admin/products/new">
                  Préparer un produit
                </Link>
              </div>
            )}
          </section>
        </>
      )}
      <div className="admin-quick-links">
        <Link href="/admin/medias">
          <Icon name="image" />
          <strong>Vos médias</strong>
          <span>Photos et image principale →</span>
        </Link>
        <Link href="/admin/digital">
          <Icon name="download" />
          <strong>SHENA Digital</strong>
          <span>Ressources privées →</span>
        </Link>
        <Link href="/admin/securite">
          <Icon name="shield" />
          <strong>Accès fondateurs</strong>
          <span>Vérifier les autorisations →</span>
        </Link>
      </div>
    </>
  );
}
