import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
export const metadata: Metadata = { title: "Votre panier" };
export default function CartPage() {
  return (
    <div className="shell">
      <div className="page-heading">
        <span className="eyebrow">VOTRE SÉLECTION</span>
        <h1>Le panier.</h1>
        <p>
          Un espace pour préparer vos envies. Aucun achat réel dans cette
          version.
        </p>
      </div>
      <CartView />
    </div>
  );
}
