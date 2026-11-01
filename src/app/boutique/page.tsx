import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { readFilters } from "@/lib/catalog";
export const metadata: Metadata = { title: "La boutique" };
export default async function Boutique({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = readFilters(await searchParams);
  return (
    <div className="shell">
      <div className="page-heading">
        <span className="eyebrow">LES UNIVERS SHENA</span>
        <h1>La boutique.</h1>
        <p>
          Des essentiels pour vous, votre maison et vos projets. Catalogue de
          démonstration.
        </p>
      </div>
      <div className="catalog-layout">
        <Catalog filters={filters} />
      </div>
    </div>
  );
}
