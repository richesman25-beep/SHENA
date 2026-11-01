import { normalizeProductType } from "@/lib/product-adapter";
import { adminView } from "@/lib/admin/auth";
import { DigitalFileForm } from "@/components/admin-forms";
export default async function DigitalAdmin() {
  const context = await adminView();
  if (!context) return null;
  const { client, capabilities } = context;
  const products = await client
    .from("products")
    .select("id,name,product_type")
    .order("name")
    .limit(200);
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
    <section className="admin-panel">
      <h2>SHENA Digital — fichiers privés</h2>
      <p>
        Les e-books, modèles et ressources sont des produits de type numérique.
        Les conditions de licence et formats détaillés nécessitent le schéma
        proposé. Aucun fichier payant n’est stocké dans le bucket d’images
        public.
      </p>
      {products.error && <p role="alert">Produits numériques indisponibles.</p>}
      {!capabilities?.digital && (
        <div className="catalog-status">
          Téléversement verrouillé : bucket privé et politiques non confirmés.
        </div>
      )}
      <DigitalFileForm
        enabled={capabilities?.digital === true}
        products={(products.data || []).filter(
          (p) => normalizeProductType(p.product_type) === "digital",
        )}
      />
      <h3>Quarantaine</h3>
      {unavailable ? (
        <p role="alert">Métadonnées indisponibles.</p>
      ) : assets.length ? (
        <ul>
          {assets.map((a) => (
            <li key={a.id}>
              {a.original_name} · {a.size_bytes} octets · {a.status}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          Aucun fichier listé. Aucun lien de téléchargement client n’est
          disponible.
        </p>
      )}
      <p>
        Une analyse antivirus et un processus de publication contrôlé sont
        requis avant toute livraison après paiement vérifié.
      </p>
    </section>
  );
}
