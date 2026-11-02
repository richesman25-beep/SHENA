import { money } from "@/lib/catalog";
import {
  orderStatusLabels,
  type CommerceOrder,
  type CommerceOrderItem,
} from "@/lib/commerce/orders";
export function OrderSummary({
  order,
  items,
}: {
  order: CommerceOrder;
  items: CommerceOrderItem[];
}) {
  return (
    <section className="checkout-panel order-detail">
      <span
        className={`publication-status ${order.status === "paid" ? "published" : ""}`}
      >
        {orderStatusLabels[order.status] || "État à vérifier"}
      </span>
      <h2>Commande {order.order_number}</h2>
      <p>
        Créée le{" "}
        {new Intl.DateTimeFormat("fr-HT", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Port-au-Prince",
        }).format(new Date(order.created_at))}
      </p>
      {order.status === "pending_payment" && (
        <p className="info-box">
          Réservation jusqu’au{" "}
          {new Intl.DateTimeFormat("fr-HT", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Port-au-Prince",
          }).format(new Date(order.reservation_expires_at))}
          . Passé ce délai, contactez la boutique. Aucun paiement n’est
          confirmé.
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.product_id}>
                <td>{i.product_name}</td>
                <td>{i.quantity}</td>
                <td>{money(i.unit_price_minor / 100)}</td>
                <td>{money(i.total_minor / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="order-totals">
        <div>
          <dt>Sous-total</dt>
          <dd>{money(order.subtotal_minor / 100)}</dd>
        </div>
        <div>
          <dt>Livraison {order.zone_name ? `· ${order.zone_name}` : ""}</dt>
          <dd>{money(order.delivery_minor / 100)}</dd>
        </div>
        <div>
          <dt>Total HTG</dt>
          <dd>{money(order.total_minor / 100)}</dd>
        </div>
      </dl>
      <p className="info-box">
        La création d’une commande ne confirme pas son paiement. Aucun fichier
        payant n’est délivré depuis cette page.
      </p>
    </section>
  );
}
