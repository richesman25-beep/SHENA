import { adminView } from "@/lib/admin/auth";
import { Icon } from "@/components/icons";
export default async function Orders() {
  if (!(await adminView())) return null;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">UNE ACTIVATION SOUMISE À VALIDATION</span>
          <h1>Commandes & paiements</h1>
          <p>Aucune commande fictive ni aucun revenu estimé.</p>
        </div>
      </div>
      <section className="workspace-panel admin-empty">
        <Icon name="bag" />
        <h2>Les commandes réelles ne sont pas activées.</h2>
        <p>
          Les structures et interfaces de prestataires sont préparées
          séparément. Aucun paiement, débit de stock, réservation ou accès
          numérique n’est déclenché depuis ce module.
        </p>
        <div className="pending-checklist">
          <span>Vérification serveur des confirmations</span>
          <span>Montant et devise contrôlés</span>
          <span>Idempotence des événements</span>
          <span>Réservations et remboursement maîtrisés</span>
          <span>Droits d’achat avant téléchargement</span>
        </div>
        <p>
          Ces contrôles doivent être validés avant de mettre ce module en
          service.
        </p>
      </section>
    </>
  );
}
