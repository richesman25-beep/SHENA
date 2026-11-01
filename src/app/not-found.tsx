import Link from "next/link";
export default function NotFound() {
  return (
    <div className="shell empty">
      <span className="eyebrow">404 / UNE PETITE IMPASSE</span>
      <h1>Cette page reste à découvrir.</h1>
      <p>
        Le produit ou la page que vous cherchez n’existe pas dans ce catalogue.
      </p>
      <Link className="button" href="/boutique">
        Retour à la boutique →
      </Link>
    </div>
  );
}
