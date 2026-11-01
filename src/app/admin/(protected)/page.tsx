import Link from "next/link";
import { adminView } from "@/lib/admin/auth";
export default async function Dashboard() {
  const context = await adminView();
  if (!context) return null;
  return (
    <div className="admin-dashboard">
      <h2>Préparer votre catalogue réel</h2>
      <p>
        Les produits proviennent de votre projet Supabase. Aucun chiffre de
        vente ni commande fictive n’est affiché.
      </p>
      <div className="admin-tiles">
        <Link href="/admin/produits">
          <h3>Catalogue</h3>
          <p>Liste, prix, stock global et visibilité</p>
        </Link>
        <Link href="/admin/categories">
          <h3>Catégories</h3>
          <p>
            {context.capabilities?.categories
              ? "Structure disponible"
              : "Migration à examiner"}
          </p>
        </Link>
        <Link href="/admin/stocks">
          <h3>Stocks géographiques</h3>
          <p>Emplacements et inventaires à préparer</p>
        </Link>
        <Link href="/admin/digital">
          <h3>SHENA Digital</h3>
          <p>Produits numériques et quarantaine privée</p>
        </Link>
      </div>
    </div>
  );
}
