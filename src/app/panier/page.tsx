import type { Metadata } from "next";
import { commerceContext } from "@/lib/commerce/server";
import { CartView } from "@/components/cart-view";
export const metadata: Metadata = { title: "Votre panier" };
export default async function CartPage() {
  let orderingEnabled = false;
  try {
    orderingEnabled = (await commerceContext())?.capabilities.orders === true;
  } catch {}
  return (
    <div className="shell">
      <div className="page-heading">
        <span className="eyebrow">VOTRE SÉLECTION</span>
        <h1>Le panier.</h1>
        <p>
          Votre panier ne déclenche aucun paiement. Les prix et les
          disponibilités sont vérifiés avant l’enregistrement d’une commande.
        </p>
      </div>
      <CartView orderingEnabled={orderingEnabled} />
    </div>
  );
}
