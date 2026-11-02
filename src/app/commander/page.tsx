import { CheckoutForm } from "@/components/checkout-form";
import { commerceContext, publicDeliveryZones } from "@/lib/commerce/server";
export const metadata = { title: "Préparer ma commande" };
export default async function Checkout() {
  let zones: Awaited<ReturnType<typeof publicDeliveryZones>> = [];
  let enabled = false,
    signedIn = false;
  let unavailable = false;
  try {
    const context = await commerceContext();
    enabled = context?.capabilities.orders === true;
    zones = await publicDeliveryZones();
    if (context) {
      const user = await context.client.auth.getUser();
      signedIn = !user.error && !!user.data.user?.email_confirmed_at;
    }
  } catch {
    unavailable = true;
  }
  return (
    <div className="shell">
      <div className="page-heading">
        <span className="eyebrow">
          DES MONTANTS VÉRIFIÉS, AVANT TOUT ENGAGEMENT
        </span>
        <h1>Préparer ma commande</h1>
        <p>
          Le serveur vérifie les produits, les prix et les stocks. Aucun
          paiement n’est déclenché par ce formulaire.
        </p>
      </div>
      {unavailable && (
        <p className="catalog-status">
          Le service de commande est indisponible. Aucun enregistrement n’est
          possible.
        </p>
      )}
      <CheckoutForm
        zones={zones}
        orderingEnabled={enabled && !unavailable}
        signedIn={signedIn}
        draftId={crypto.randomUUID()}
      />
    </div>
  );
}
