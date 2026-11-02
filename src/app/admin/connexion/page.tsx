import Link from "next/link";
import { LoginForm } from "@/components/admin-forms";
import { getSupabaseConfig } from "@/lib/supabase/config";
export const metadata = { title: "Connexion administrateur" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  let configured = false;
  try {
    configured = !!getSupabaseConfig();
  } catch {}
  return (
    <div className="shell admin-surface admin-login">
      <div className="auth-wordmark">
        SHENA<span>Admin</span>
      </div>
      <span className="eyebrow">VOTRE BOUTIQUE, VOTRE ESPACE</span>
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
      {query.password === "updated" && (
        <p role="status" className="admin-success">
          Votre mot de passe a été modifié. Reconnectez-vous avec votre nouveau
          mot de passe.
        </p>
      )}
      {query.recovery === "failed" && (
        <p role="alert" className="admin-error">
          Ce lien de récupération est invalide, expiré ou non autorisé. Demandez
          un nouveau lien.
        </p>
      )}
      <LoginForm enabled={configured} />
      <Link className="auth-forgot" href="/admin/mot-de-passe-oublie">
        Mot de passe oublié ?
      </Link>
      <Link className="auth-back" href="/">
        ← Retour à la boutique
      </Link>
    </div>
  );
}
