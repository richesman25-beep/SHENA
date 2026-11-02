import {
  DigitalMetadataForm,
  type DigitalDetails,
} from "@/components/admin-digital-form";
import { normalizeProductType } from "@/lib/product-adapter";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminView } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { existingProductColumns } from "@/lib/supabase/config";
import {
  ProductEditorForm,
  ProductImageUpload,
  PublicationForm,
} from "@/components/admin-product-form";
import { ProductMediaPanel } from "@/components/admin-product-media";
import { ProductCategoryPanel } from "@/components/admin-product-categories";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await adminView();
  if (!context) return null;
  const { client, capabilities } = context;
  const { id } = await params;
  if (!validUuid(id)) notFound();
  const { data, error } = await client
    .from("products")
    .select(existingProductColumns)
    .eq("id", id)
    .single();
  if (error || !data)
    return (
      <section className="workspace-panel">
        <h1>Produit inaccessible</h1>
        <p role="alert">
          Le produit est absent, non autorisé ou momentanément indisponible.
        </p>
      </section>
    );
  let details: DigitalDetails | undefined;
  if (
    normalizeProductType(data.product_type || "") === "digital" &&
    capabilities?.digitalMetadata
  ) {
    const meta = await client
      .from("digital_product_details")
      .select("kind,formats,license,compatibility,contents")
      .eq("product_id", id)
      .maybeSingle();
    if (!meta.error && meta.data) details = meta.data as DigitalDetails;
  }
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">MODIFIER VOTRE CATALOGUE</span>
          <h1>{data.name}</h1>
          <p>
            <span
              className={`publication-status ${data.active ? "published" : ""}`}
            >
              {data.active ? "Publié" : "Non publié"}
            </span>{" "}
            · Prix et stock global
          </p>
        </div>
        <Link
          className="button button-secondary"
          href={`/admin/products/${id}/preview`}
        >
          Prévisualiser le produit ↗
        </Link>
      </div>
      <div className="editor-layout">
        <div>
          <section className="workspace-panel">
            <h2>Informations du produit</h2>
            <ProductEditorForm
              product={data}
              enabled={capabilities?.products === true}
            />
          </section>
          <ProductCategoryPanel productId={id} />
          {normalizeProductType(data.product_type || "") === "digital" && (
            <section className="workspace-panel">
              <h2>Informations SHENA Digital</h2>
              <DigitalMetadataForm
                productId={id}
                details={details}
                enabled={capabilities?.digitalMetadata === true}
              />
              {!capabilities?.digitalMetadata && (
                <p className="admin-muted">
                  Champs structurés non enregistrables tant que le schéma
                  numérique n’est pas confirmé.
                </p>
              )}
            </section>
          )}
        </div>
        <aside>
          <section className="workspace-panel">
            <h2>Images du produit</h2>
            <ProductMediaPanel product={data} />
            <ProductImageUpload
              id={id}
              enabled={
                capabilities?.images === true && capabilities?.products === true
              }
            />
          </section>
          <section className="workspace-panel">
            <h2>Publication & conservation</h2>
            <PublicationForm
              product={data}
              enabled={capabilities?.products === true}
            />
            <p className="admin-muted">
              Aucune suppression définitive de produit n’est proposée. Toutes
              ses dépendances sont conservées.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
