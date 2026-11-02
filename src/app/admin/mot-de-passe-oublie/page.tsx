import Link from "next/link";
import { PasswordResetRequestForm } from "@/components/admin-recovery-forms";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { trustedRecoveryOrigin } from "@/lib/admin/recovery";
export const metadata = { title: "Récupération de votre accès administrateur" };
export default function Forgot() {
  let configured = false;
  try {
    configured = !!getSupabaseConfig() && !!trustedRecoveryOrigin(process.env);
  } catch {}
  return (
    <section className="shell admin-surface admin-login">
      <div className="auth-wordmark">
        SHENA<span>Admin</span>
      </div>
      <span className="eyebrow">RETROUVER VOTRE ACCÈS</span>
      <h1>Mot de passe oublié ?</h1>
      <p>
        Recevez un lien personnel pour choisir un nouveau mot de passe. Vos
        droits resteront vérifiés par le serveur.
      </p>
      {!configured && (
        <div className="admin-notice">
          <p>
            La récupération doit être configurée par le responsable du site.
            Aucun e-mail ne sera envoyé depuis cet écran tant que le service
            n’est pas prêt.
          </p>
        </div>
      )}
      <PasswordResetRequestForm enabled={configured} />
      <Link className="auth-back" href="/admin/connexion">
        ← Retour à la connexion
      </Link>
    </section>
  );
}
