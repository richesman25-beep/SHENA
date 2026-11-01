import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Mes achats numériques — à venir" };
export default function Library() {
  return (
    <div className="shell library-page">
      <span className="eyebrow">SHENA DIGITAL / VOTRE BIBLIOTHÈQUE</span>
      <h1>Mes achats numériques</h1>
      <div className="library-preview">
        <span>✦</span>
        <h2>Vos futures ressources, au même endroit.</h2>
        <p>
          La bibliothèque n’est pas encore disponible. Aucun achat ni
          téléchargement n’est simulé.
        </p>
        <p>
          Après mise en place des comptes et confirmation fiable d’un paiement,
          vos ressources pourront apparaître ici. Les fichiers seront privés et
          les droits vérifiés côté serveur avant chaque lien temporaire.
        </p>
        <Link href="/numerique" className="button">
          Explorer les aperçus numériques →
        </Link>
      </div>
    </div>
  );
}
