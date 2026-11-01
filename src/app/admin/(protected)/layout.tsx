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
      <div className="shell admin-unavailable">
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
    <div className="shell admin-shell">
      <header className="admin-heading">
        <div>
          <span className="eyebrow">ESPACE PROFESSIONNEL</span>
          <h1>Administration SHENA</h1>
        </div>
        <form action={logoutAction}>
          <button className="button">Se déconnecter</button>
        </form>
      </header>
      <nav className="admin-nav" aria-label="Administration">
        <Link href="/admin">Vue d’ensemble</Link>
        <Link href="/admin/produits">Produits</Link>
        <Link href="/admin/categories">Catégories</Link>
        <Link href="/admin/stocks">Stocks multivilles</Link>
        <Link href="/admin/digital">SHENA Digital</Link>
      </nav>
      {!context.capabilities && (
        <div className="catalog-status">
          Rôle confirmé. Les politiques et capacités d’écriture ne sont pas
          confirmées : toutes les écritures sont verrouillées. La liste peut
          être limitée par les politiques de lecture existantes.
        </div>
      )}
      {children}
    </div>
  );
}
