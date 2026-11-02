import Link from "next/link";
import { adminView } from "@/lib/admin/auth";
import { Icon } from "@/components/icons";
export default async function Security() {
  const context = await adminView();
  if (!context) return null;
  const caps = context.capabilities;
  const features = [
    ["Produits : création, modification et publication", caps?.products],
    ["Catégories", caps?.categories],
    ["Import d’images publiques", caps?.images],
    ["Galeries et registre des médias", caps?.mediaManage],
    ["Suppression contrôlée des médias inutilisés", caps?.mediaDelete],
    ["Stockage privé en quarantaine", caps?.digital],
    ["Informations numériques structurées", caps?.digitalMetadata],
  ] as const;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">VOS ACCÈS ET AUTORISATIONS</span>
          <h1>Sécurité</h1>
          <p>
            Les rôles sont vérifiés côté serveur à chaque opération sensible.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin/mot-de-passe">
          Changer mon mot de passe
        </Link>
      </div>
      <div className="dashboard-composition">
        <section className="workspace-panel">
          <h2>Votre session</h2>
          <div className="security-session">
            <Icon name="shield" />
            <div>
              <strong>{context.userEmail || "Votre compte"}</strong>
              <p>Administrateur confirmé par Supabase Auth.</p>
            </div>
          </div>
          <p className="admin-muted">
            Chaque fondateur doit posséder son propre compte et son propre mot
            de passe. La connaissance de cette URL ne donne aucun droit.
          </p>
          <p className="admin-muted">
            L’attribution ou la révocation d’un rôle est une opération réservée
            à un opérateur habilité, après vérification d’identité. Aucune
            auto-promotion n’est disponible.
          </p>
        </section>
        <section className="workspace-panel">
          <h2>Capacités confirmées</h2>
          <ul className="security-capabilities">
            {features.map(([label, enabled]) => (
              <li key={label}>
                <span>{label}</span>
                <b className={enabled ? "ready" : ""}>
                  {enabled ? "Confirmée" : "Non confirmée"}
                </b>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="workspace-panel">
        <h2>Avant une nouvelle activation</h2>
        <ol className="admin-procedure">
          <li>
            Vérifier une sauvegarde restaurable et les permissions existantes.
          </li>
          <li>
            Examiner les propositions SQL et obtenir l’accord du propriétaire.
          </li>
          <li>
            Valider les accès admin, non-admin et anonymes sur un environnement
            isolé.
          </li>
          <li>
            Activer séparément les commandes, paiements et téléchargements
            uniquement après leur recette.
          </li>
        </ol>
        <p className="admin-inline-notice">
          Les valeurs des clés, mots de passe et jetons ne sont jamais affichées
          sur cet écran.
        </p>
      </section>
    </>
  );
}
