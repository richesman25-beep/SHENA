import Link from "next/link";
import { adminView } from "@/lib/admin/auth";
import { existingProductColumns } from "@/lib/supabase/config";
import { money } from "@/lib/catalog";
export default async function Products() {
  const context = await adminView();
  if (!context) return null;
  const { client, capabilities } = context;
  const result = await client
    .from("products")
    .select(existingProductColumns)
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <section>
      <div className="section-heading">
        <h2>Produits Supabase</h2>
        <Link className="button" href="/admin/produits/nouveau">
          Créer un produit
        </Link>
      </div>
      {result.error ? (
        <div role="alert" className="catalog-status">
          Lecture refusée ou indisponible. Vérifiez RLS et les droits du compte.
        </div>
      ) : (
        <>
          <p>
            Jusqu’à 200 produits récents visibles par ce compte.{" "}
            {capabilities?.products
              ? "La politique administrateur permet aussi la lecture des produits inactifs."
              : "Les politiques existantes peuvent masquer les produits inactifs."}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Type enregistré</th>
                  <th>Prix HTG</th>
                  <th>Stock global</th>
                  <th>Actif</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.product_type}</td>
                    <td>{money(Number(p.price_htg))}</td>
                    <td>{p.stock ?? "Non renseigné"}</td>
                    <td>{p.active ? "Oui" : "Non"}</td>
                    <td>
                      <Link href={`/admin/produits/${p.id}`}>Modifier</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.data.length && <p>Aucun produit accessible à ce compte.</p>}
        </>
      )}
    </section>
  );
}
