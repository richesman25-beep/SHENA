import { AdminNavigation } from "@/components/admin-navigation";
import { Icon } from "@/components/icons";
import Link from "next/link";
import { adminPage } from "@/lib/admin/auth";
import { logoutAction } from "../actions";
export const metadata = {
  title: "Administration SHENA",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await adminPage();
  if (context.status !== "admin")
    return (
      <div className="shell admin-surface admin-unavailable">
        <span className="eyebrow">ADMINISTRATION PROTÉGÉE</span>
        <h1>
          {context.status === "forbidden"
            ? "Accès refusé"
            : "Administration indisponible"}
        </h1>
        <p>
          {context.status === "forbidden"
            ? "Votre compte ne possède pas le rôle administrateur vérifié côté serveur."
            : context.status === "unconfigured"
              ? "La connexion Supabase doit être configurée avant toute authentification."
              : "Le service d’authentification est momentanément indisponible."}
        </p>
        <Link className="button" href="/admin/connexion">
          Accéder à la connexion
        </Link>
      </div>
    );
  return (
    <div className="admin-surface admin-workspace">
      <aside className="workspace-sidebar">
        <Link href="/admin" className="workspace-brand">
          SHENA<span>Admin</span>
          <b>ESPACE FONDATEURS</b>
        </Link>
        <span className="workspace-menu-label">VOTRE BOUTIQUE</span>
        <AdminNavigation />
        <div className="workspace-sidebar-bottom">
          <Link href="/" target="_blank" rel="noreferrer">
            Voir la boutique ↗
          </Link>
          <p>
            Commandes et paiements réels
            <br />
            non activés.
          </p>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span>GESTION DE VOTRE BOUTIQUE</span>
            <strong>Bonjour, bienvenue sur SHENA Admin.</strong>
          </div>
          <div className="workspace-user">
            <Icon name="shield" />
            <span>
              {context.userEmail || "Compte administrateur"}
              <small>Autorisation vérifiée côté serveur</small>
            </span>
            <form action={logoutAction}>
              <button>Se déconnecter</button>
            </form>
          </div>
        </header>
        <div className="workspace-content">
          {!context.capabilities && (
            <div className="admin-notice">
              <Icon name="shield" />
              <p>
                <strong>Accès confirmé, écritures verrouillées.</strong> Les
                autorisations nécessaires ne sont pas encore confirmées par
                Supabase. Les données affichées restent limitées aux lignes
                accessibles à ce compte.
              </p>
            </div>
          )}
          {children}
        </div>
        <footer className="workspace-footer">
          <span>SHENA Admin · Espace sécurisé</span>
          <Link href="/admin/securite">Permissions & accès</Link>
        </footer>
      </div>
    </div>
  );
}
