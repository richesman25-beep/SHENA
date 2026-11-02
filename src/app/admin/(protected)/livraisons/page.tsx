import { adminView } from "@/lib/admin/auth";
import { commerceContext } from "@/lib/commerce/server";
import type { DeliveryZone } from "@/lib/commerce/quote";
import { DeliveryZoneForm } from "@/components/admin-commerce-forms";
export default async function DeliveryAdmin() {
  if (!(await adminView())) return null;
  const context = await commerceContext();
  let zones: DeliveryZone[] = [];
  let unavailable = false;
  if (context?.capabilities.delivery) {
    const result = await context.client
      .from("commerce_delivery_zones")
      .select("id,name,department_id,commune_id,fee_minor,active")
      .order("name");
    zones = result.data || [];
    unavailable = !!result.error;
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">DES FRAIS EXPLICITES</span>
          <h1>Zones et tarifs de livraison</h1>
          <p>
            Aucun tarif n’est inventé. Les nouvelles commandes utilisent un
            tarif actif vérifié côté serveur.
          </p>
        </div>
      </div>
      {!context?.capabilities.delivery && (
        <p className="admin-notice">
          Configuration staging et permissions de livraison non confirmées.
          Aucun tarif ne sera enregistré.
        </p>
      )}
      {unavailable && (
        <p className="admin-error" role="alert">
          Les tarifs ne peuvent pas être chargés.
        </p>
      )}
      <div className="admin-two-columns">
        <section className="workspace-panel">
          <h2>Ajouter une zone</h2>
          <DeliveryZoneForm
            enabled={context?.capabilities.delivery === true && !unavailable}
          />
        </section>
        <section className="workspace-panel">
          <h2>Règles de fonctionnement</h2>
          <p>
            Choisissez un département et éventuellement une commune du
            référentiel actuellement pris en charge. Un montant nul doit être
            une décision explicite de la boutique, jamais une valeur de
            remplacement.
          </p>
          <p>
            La désactivation d’une zone bloque les nouvelles commandes
            concernées. Les commandes existantes conservent leur tarif
            enregistré.
          </p>
        </section>
      </div>
      <div className="admin-tiles">
        {zones.map((z) => (
          <section className="workspace-panel" key={z.id}>
            <h2>{z.name}</h2>
            <DeliveryZoneForm
              zone={z}
              enabled={context?.capabilities.delivery === true}
            />
          </section>
        ))}
      </div>
    </>
  );
}
