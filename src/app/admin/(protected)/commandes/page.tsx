import Link from "next/link";
import { adminView } from "@/lib/admin/auth";
import { commerceContext } from "@/lib/commerce/server";
import {
  orderSummaryColumns,
  orderStatusLabels,
  type CommerceOrder,
} from "@/lib/commerce/orders";
import { money } from "@/lib/catalog";
export default async function Orders() {
  if (!(await adminView())) return null;
  const context = await commerceContext();
  let rows: CommerceOrder[] = [];
  let unavailable = false;
  if (context?.capabilities.orders) {
    const result = await context.client
      .from("commerce_orders")
      .select(orderSummaryColumns)
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (result.data as CommerceOrder[]) || [];
    unavailable = !!result.error;
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">SUIVI DES COMMANDES ENREGISTRÉES</span>
          <h1>Commandes & paiements</h1>
          <p>
            Aucune commande fictive ni aucun revenu estimé. Dernières 100
            commandes accessibles.
          </p>
        </div>
        <Link href="/admin/livraisons" className="button button-secondary">
          Configurer les livraisons
        </Link>
      </div>
      {!context?.capabilities.orders ? (
        <section className="workspace-panel admin-empty">
          <h2>Les commandes réelles ne sont pas activées.</h2>
          <p>
            Ce module nécessite l’environnement staging identifié, les
            migrations approuvées et une recette complète. Aucun paiement, débit
            de stock ou accès numérique n’est déclenché ici.
          </p>
        </section>
      ) : unavailable ? (
        <p role="alert" className="admin-error">
          Le suivi ne peut pas être chargé. Vérifiez les permissions et la
          connexion.
        </p>
      ) : (
        <section className="workspace-panel">
          {!rows.length ? (
            <div className="admin-empty">
              <h2>Aucune commande accessible.</h2>
              <p>Aucune ligne de démonstration n’est ajoutée.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Client</th>
                    <th>Statut</th>
                    <th>Total HTG</th>
                    <th>Suivi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td>{o.customer_name}</td>
                      <td>{orderStatusLabels[o.status] || "À vérifier"}</td>
                      <td>{money(o.total_minor / 100)}</td>
                      <td>
                        <Link href={`/admin/commandes/${o.id}`}>Ouvrir →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
