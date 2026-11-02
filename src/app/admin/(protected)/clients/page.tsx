import { adminView } from "@/lib/admin/auth";
import { Icon } from "@/components/icons";
export default async function Clients() {
  if (!(await adminView())) return null;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">LA CONFIDENTIALITÉ AVANT TOUT</span>
          <h1>Clients</h1>
          <p>
            Un futur espace limité aux informations nécessaires à la gestion des
            achats.
          </p>
        </div>
      </div>
      <section className="workspace-panel admin-empty">
        <Icon name="users" />
        <h2>
          Les données clients ne sont pas connectées à ce tableau de bord.
        </h2>
        <p>
          Aucun profil ni historique client n’est inventé. Les futures
          politiques limiteront les données visibles au propriétaire du compte
          et aux administrateurs autorisés selon leur besoin métier.
        </p>
        <p>
          Aucune clé privilégiée n’est utilisée pour parcourir les utilisateurs
          Supabase Auth.
        </p>
      </section>
    </>
  );
}
