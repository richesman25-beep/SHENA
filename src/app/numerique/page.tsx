import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { readFilters } from "@/lib/catalog";
export const metadata: Metadata = { title: "Le département numérique" };
export default async function Digital({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="shell">
      <div className="page-heading digital-heading">
        <span className="eyebrow">SHENA STUDIO</span>
        <h1>De l’idée au projet.</h1>
        <p>
          Des ressources pour créer, apprendre et vous organiser. Découvrez nos
          exemples de planners et modèles professionnels.
        </p>
        <div className="chips">
          <span>PDF & e-books</span>
          <span>Modèles & templates</span>
          <span>Ressources créatives</span>
        </div>
        <small>
          Catalogue de démonstration. Aucun paiement ni téléchargement
          disponible.
        </small>
      </div>
      <div className="catalog-layout">
        <Catalog digital filters={readFilters(await searchParams)} />
      </div>
    </div>
  );
}
