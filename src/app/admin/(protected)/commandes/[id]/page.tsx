import Link from "next/link";
import { notFound } from "next/navigation";
import { adminView } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { commerceContext } from "@/lib/commerce/server";
import {
  orderDetailColumns,
  type CommerceOrder,
  type CommerceOrderItem,
  type PaymentReview,
} from "@/lib/commerce/orders";
import { OrderSummary } from "@/components/order-summary";
import {
  OrderTransitionForm,
  SubmitPaymentReviewForm,
  DecidePaymentReviewForm,
} from "@/components/admin-commerce-forms";
import { money } from "@/lib/catalog";
export default async function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await adminView();
  if (!admin) return null;
  const { id } = await params;
  if (!validUuid(id)) notFound();
  const context = await commerceContext();
  if (!context?.capabilities.orders)
    return (
      <section className="workspace-panel">
        <h1>Suivi indisponible</h1>
        <p>Commandes non activées sur cet environnement.</p>
      </section>
    );
  const result = await context.client
    .from("commerce_orders")
    .select(orderDetailColumns)
    .eq("id", id)
    .maybeSingle();
  if (result.error)
    return (
      <p className="admin-error" role="alert">
        Commande inaccessible ou connexion interrompue.
      </p>
    );
  if (!result.data) notFound();
  const order = result.data as CommerceOrder;
  const [items, reviews, audit] = await Promise.all([
    context.client
      .from("commerce_order_lines")
      .select(
        "product_id,product_name,product_type,quantity,unit_price_minor,total_minor",
      )
      .eq("order_id", id),
    context.client
      .from("commerce_payment_reviews")
      .select(
        "id,provider,external_reference,amount_minor,status,submitted_by,verified_by,created_at,review_note,submit_note",
      )
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    context.client
      .from("commerce_audit_events")
      .select("id,action,actor_id,created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (items.error || reviews.error || audit.error)
    return (
      <p className="admin-error" role="alert">
        Le détail ou le journal ne peut pas être chargé. Aucune action proposée.
      </p>
    );
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">TRAÇABILITÉ ET CONTRÔLE</span>
          <h1>{order.order_number}</h1>
        </div>
        <Link href="/admin/commandes" className="button button-secondary">
          Retour aux commandes
        </Link>
      </div>
      <div className="editor-layout">
        <div>
          <OrderSummary
            order={order}
            items={items.data as CommerceOrderItem[]}
          />
          <section className="workspace-panel">
            <h2>Coordonnées de livraison</h2>
            <p>
              {order.customer_name} · {order.customer_phone}
            </p>
            <p className="preview-description">
              {order.delivery_address || "Pas de livraison physique."}
            </p>
            <p>{order.note}</p>
          </section>
          <section className="workspace-panel">
            <h2>Journal de la commande</h2>
            <ul className="admin-procedure">
              {audit.data.map((event) => (
                <li key={event.id}>
                  {event.action} ·{" "}
                  {new Intl.DateTimeFormat("fr-HT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "America/Port-au-Prince",
                  }).format(new Date(event.created_at))}{" "}
                  · acteur {event.actor_id || "système"}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside>
          <section className="workspace-panel">
            <h2>Évolution du statut</h2>
            <OrderTransitionForm order={order} enabled />
          </section>
          <section className="workspace-panel">
            <h2>Vérification manuelle du paiement</h2>
            {!context.capabilities.manualPayments && (
              <p className="admin-notice">
                Paiements manuels non activés. Aucun paiement ne peut être
                confirmé.
              </p>
            )}
            <SubmitPaymentReviewForm
              order={order}
              enabled={context.capabilities.manualPayments}
              draftId={crypto.randomUUID()}
            />
          </section>
          {(reviews.data as PaymentReview[]).map((r) => (
            <section className="workspace-panel" key={r.id}>
              <h2>Contrôle {r.provider}</h2>
              <p>
                {r.external_reference} · {money(r.amount_minor / 100)}
              </p>
              <p>{r.review_note}</p>
              <DecidePaymentReviewForm
                review={r}
                orderId={id}
                currentUserId={admin.userId}
                enabled={context.capabilities.manualPayments}
              />
            </section>
          ))}
        </aside>
      </div>
    </>
  );
}
