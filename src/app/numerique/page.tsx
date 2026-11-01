import type { Metadata } from "next";
import Link from "next/link";
import { Catalog } from "@/components/catalog";
import { ProductVisual } from "@/components/product-visual";
import { readFilters } from "@/lib/catalog";
import { storefront } from "@/lib/storefront";
export const metadata: Metadata = {
  title: "SHENA Digital — Ressources & modèles",
};
export default async function Digital({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="shell">
      <section className="digital-hero">
        <div>
          <span className="digital-wordmark">
            SHENA <b>Digital</b>
            <sup>✦</sup>
          </span>
          <h1>
            Les bons outils.
            <br />
            Pour vos grandes idées.
          </h1>
          <p>
            Créez, organisez, apprenez. Un univers de ressources numériques pour
            donner de l’élan à vos projets.
          </p>
          <a href="#catalogue-numerique" className="button">
            Explorer les ressources →
          </a>
          <small>
            SHENA STUDIO · Démonstration · Aucun téléchargement disponible
          </small>
        </div>
        <div className="digital-hero-covers">
          <ProductVisual image="planner" name="Mon planner essentiel" />
          <ProductVisual image="template" name="Kit CV professionnel" />
        </div>
      </section>
      <section className="digital-topics" aria-label="Univers numériques">
        {storefront.digitalTopics.map((t, i) => (
          <Link
            href={`/numerique?q=${encodeURIComponent(t.query)}#catalogue-numerique`}
            key={t.name}
          >
            <span>{["▤", "✦", "▦", "▷", "▣", "◈"][i]}</span>
            <h2>{t.name}</h2>
            <p>{t.description}</p>
          </Link>
        ))}
      </section>
      <div className="digital-catalog-heading" id="catalogue-numerique">
        <h2>Les ressources à découvrir</h2>
        <p>
          Deux exemples disponibles dans ce catalogue. Les autres univers seront
          enrichis avant lancement.
        </p>
        <p>
          Format, licence et aperçu sur chaque fiche. Aucun paiement ni
          téléchargement disponible.
        </p>
      </div>
      <div className="catalog-layout">
        <Catalog digital filters={readFilters(await searchParams)} />
      </div>
    </div>
  );
}
