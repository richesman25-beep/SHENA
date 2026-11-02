import Link from "next/link";
import { notFound } from "next/navigation";
import { adminView } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { existingProductColumns } from "@/lib/supabase/config";
import { money } from "@/lib/catalog";
import { safeImageUrl, normalizeProductType } from "@/lib/product-adapter";
import { ProductGallery } from "@/components/product-gallery";
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await adminView();
  if (!context) return null;
  const { id } = await params;
  if (!validUuid(id)) notFound();
  const result = await context.client
    .from("products")
    .select(existingProductColumns)
    .eq("id", id)
    .single();
  if (result.error || !result.data)
    return <p role="alert">Produit inaccessible.</p>;
  const p = result.data;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">
            APERÇU INTERNE — AUCUNE PUBLICATION AUTOMATIQUE
          </span>
          <h1>Prévisualiser le produit</h1>
          <p>
            {p.active
              ? "Ce produit est actif dans Supabase."
              : "Ce produit n’est pas publié dans la boutique."}
          </p>
        </div>
        <Link
          className="button button-secondary"
          href={`/admin/products/${id}`}
        >
          Revenir à l’édition
        </Link>
      </div>
      <section className="workspace-panel admin-product-preview">
        <ProductGallery
          image=""
          name={p.name || "Nom à renseigner"}
          url={safeImageUrl(p.image_url)}
          live
        />
        <div>
          <span className="product-kind">
            {normalizeProductType(p.product_type || "") === "digital"
              ? "Produit numérique"
              : "Produit physique / à vérifier selon le type"}
          </span>
          <h2>{p.name || "Nom à renseigner"}</h2>
          <strong className="preview-price">
            {p.price_htg === null
              ? "Prix non renseigné"
              : money(Number(p.price_htg))}
          </strong>
          <p className="preview-description">
            {p.description || "Description non renseignée."}
          </p>
          <p>
            Stock global :{" "}
            {normalizeProductType(p.product_type || "") === "digital"
              ? "non applicable"
              : (p.stock ?? "non renseigné")}
          </p>
          <div className="admin-inline-notice">
            Aperçu administratif uniquement. Aucune commande, réservation ou
            livraison de fichier n’est déclenchée.
          </div>
        </div>
      </section>
    </>
  );
}
