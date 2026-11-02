import Link from "next/link";
import { adminProductData } from "@/lib/admin/data";
import { normalizeProductType } from "@/lib/product-adapter";
import { DigitalFileForm } from "@/components/admin-forms";
export default async function DigitalAdmin() {
  const data = await adminProductData();
  if (!data) return null;
  const { client, capabilities } = data.context;
  const digital = data.products.filter(
    (p) => normalizeProductType(p.product_type || "") === "digital",
  );
  let assets: {
    id: string;
    original_name: string;
    status: string;
    size_bytes: number;
  }[] = [];
  let unavailable = false;
  if (capabilities?.digital) {
    const result = await client
      .from("digital_assets")
      .select("id,original_name,status,size_bytes")
      .order("created_at", { ascending: false })
      .limit(100);
    assets = result.data || [];
    unavailable = !!result.error;
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">VOTRE DÉPARTEMENT NUMÉRIQUE</span>
          <h1>SHENA Digital</h1>
          <p>
            E-books, templates, documents, ressources et formations autorisés.
          </p>
        </div>
        <Link className="button" href="/admin/products/new">
          + Ajouter une ressource
        </Link>
      </div>
      {data.error && (
        <p role="alert" className="admin-error">
          {data.error}
        </p>
      )}
      <div className="dashboard-composition">
        <section className="workspace-panel">
          <h2>Vos produits numériques</h2>
          {digital.length ? (
            <div className="digital-admin-list">
              {digital.map((p) => (
                <Link href={`/admin/products/${p.id}`} key={p.id}>
                  <span>▤</span>
                  <div>
                    <strong>{p.name || "Nom à renseigner"}</strong>
                    <small>
                      {p.active ? "Publié" : "Non publié"} · Compléter formats,
                      licence et fichiers
                    </small>
                  </div>
                  <b>Gérer →</b>
                </Link>
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              <h3>Aucune ressource numérique accessible.</h3>
              <p>
                Créez un produit numérique ou vérifiez vos autorisations de
                lecture.
              </p>
            </div>
          )}
        </section>
        <section className="workspace-panel">
          <h2>Fichiers en quarantaine privée</h2>
          <p className="admin-muted">
            Aucun fichier payant n’est conservé dans le bucket public d’images.
            Aucun lien client n’est produit.
          </p>
          {!capabilities?.digital && (
            <div className="admin-inline-notice">
              Téléversement verrouillé : les permissions du stockage privé ne
              sont pas confirmées.
            </div>
          )}
          <DigitalFileForm
            enabled={capabilities?.digital === true}
            extended={capabilities?.extendedDigitalUploads === true}
            products={digital.map((p) => ({
              id: p.id,
              name: p.name || "Nom à renseigner",
            }))}
          />
        </section>
      </div>
      <section className="workspace-panel">
        <div className="panel-heading">
          <h2>Fichiers privés accessibles à l’administration</h2>
          <span className="publication-status">
            Livraison client non activée
          </span>
        </div>
        {unavailable ? (
          <p role="alert">
            Les métadonnées des fichiers ne peuvent pas être chargées.
          </p>
        ) : assets.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Taille</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td>{a.original_name}</td>
                    <td>{Math.round(a.size_bytes / 1024)} Ko</td>
                    <td>
                      {a.status === "quarantine"
                        ? "En quarantaine — analyse requise"
                        : a.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-muted">
            Aucun fichier listé. Cette absence ne prouve pas que le bucket privé
            soit vide.
          </p>
        )}
        <p className="admin-inline-notice">
          La publication des fichiers et les téléchargements après paiement
          seront activés uniquement après vérification serveur du paiement,
          droits d’achat et analyse de sécurité. Aucun de ces contrôles n’est
          simulé.
        </p>
      </section>
    </>
  );
}
