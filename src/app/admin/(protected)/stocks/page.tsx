import { adminView } from "@/lib/admin/auth";
export default async function GeographyAdmin() {
  const context = await adminView();
  if (!context) return null;
  const { capabilities } = context;
  return (
    <section className="workspace-panel">
      <h1>Stocks par emplacement</h1>
      <p>
        Le stock actuel de public.products est global. Il ne permet pas de
        déduire la quantité à Hinche, Maïssade, Cap-Haïtien ou Port-au-Prince.
      </p>
      <div className="catalog-status">
        Écriture géographique non activée dans cette phase.{" "}
        {capabilities?.geography
          ? "Un schéma a été signalé ; son adaptation aux politiques et à la reprise du stock reste à valider."
          : "Les structures et politiques n’ont pas été confirmées."}
      </div>
      <ol>
        <li>
          Valider une sauvegarde et un test de restauration du projet existant.
        </li>
        <li>
          Examiner les propositions départements, communes, points, inventaires
          et règles de livraison.
        </li>
        <li>Réconcilier les totaux réels avant d’autoriser la répartition.</li>
        <li>
          Activer une procédure transactionnelle après validation, sans mettre à
          zéro les anciens stocks.
        </li>
      </ol>
      <p>
        La sélection manuelle et le filtre de proximité sont conservés pour le
        mode démo. Le catalogue réel n’utilise jamais les points fictifs.
      </p>
    </section>
  );
}
