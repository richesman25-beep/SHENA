import { LoginForm } from "@/components/admin-forms";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Connexion administrateur" };
export default function Login() {
  let configured = false;
  try {
    configured = !!getSupabaseConfig();
  } catch {}
  return (
    <div className="shell admin-login">
      <span className="eyebrow">SHENA / ACCÈS PROFESSIONNEL</span>
      <h1>Connexion administrateur</h1>
      <p>
        L’accès est vérifié côté serveur. Une session seule ne donne aucun droit
        d’administration.
      </p>
      {!configured && (
        <div className="catalog-status">
          Supabase non configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans les paramètres
          d’environnement.
        </div>
      )}
      <LoginForm enabled={configured} />
    </div>
  );
}
