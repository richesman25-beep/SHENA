import { ManualPaymentInstructions } from "@/components/manual-payment-instructions";
import { DigitalOrderDownloads } from "@/components/digital-order-downloads";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { commerceContext } from "@/lib/commerce/server";
import { validUuid } from "@/lib/admin/policy";
import {
  orderDetailColumns,
  type CommerceOrder,
  type CommerceOrderItem,
} from "@/lib/commerce/orders";
import { OrderSummary } from "@/components/order-summary";
import { customerLogoutAction } from "../../actions";
export const metadata = {
  title: "Suivi de commande",
  robots: { index: false, follow: false },
};
export default async function CustomerOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validUuid(id)) notFound();
  const context = await commerceContext();
  if (!context?.capabilities.orders)
    return (
      <div className="shell page-heading">
        <h1>Suivi indisponible</h1>
        <p>Les commandes ne sont pas activées sur cet environnement.</p>
      </div>
    );
  const auth = await context.client.auth.getUser();
  if (auth.error || !auth.data.user?.email_confirmed_at)
    redirect("/compte/connexion");
  const result = await context.client
    .from("commerce_orders")
    .select(orderDetailColumns)
    .eq("id", id)
    .eq("customer_id", auth.data.user.id)
    .maybeSingle();
  if (result.error)
    return (
      <div className="shell page-heading">
        <h1>Commande indisponible</h1>
        <p role="alert">
          Le suivi ne peut pas être chargé. Réessayez plus tard.
        </p>
      </div>
    );
  if (!result.data) notFound();
  const items = await context.client
    .from("commerce_order_lines")
    .select(
      "product_id,product_name,product_type,quantity,unit_price_minor,total_minor",
    )
    .eq("order_id", id);
  if (items.error)
    return (
      <div className="shell page-heading">
        <h1>Commande indisponible</h1>
        <p role="alert">Le détail ne peut pas être chargé.</p>
      </div>
    );
  return (
    <div className="shell">
      <div className="page-heading">
        <span className="eyebrow">VOTRE COMMANDE</span>
        <h1>Suivi et statut</h1>
        <p>Les montants ci-dessous ont été enregistrés côté serveur.</p>
      </div>
      <OrderSummary
        order={result.data as CommerceOrder}
        items={items.data as CommerceOrderItem[]}
      />
      <ManualPaymentInstructions
        client={context.client}
        enabled={context.capabilities.manualPayments}
        status={result.data.status}
      />
      <DigitalOrderDownloads
        status={result.data.status}
        productIds={(items.data as CommerceOrderItem[])
          .filter((i) => i.product_type === "digital")
          .map((i) => i.product_id)}
      />
      <Link href="/boutique" className="button button-secondary">
        Revenir à la boutique
      </Link>
      <form action={customerLogoutAction}>
        <button className="text-link">Me déconnecter</button>
      </form>
    </div>
  );
}
