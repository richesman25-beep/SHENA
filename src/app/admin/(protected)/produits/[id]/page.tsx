import { notFound } from "next/navigation";
import { adminView } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { existingProductColumns } from "@/lib/supabase/config";
import { ProductForm, ImageForm } from "@/components/admin-forms";
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
      <div role="alert" className="catalog-status">
        Produit absent, inaccessible à ce compte ou service indisponible.
      </div>
    );
  return (
    <div className="admin-two-columns">
      <section className="admin-panel">
        <h2>Modifier {data.name}</h2>
        <ProductForm product={data} enabled={capabilities?.products === true} />
      </section>
      <section className="admin-panel">
        <h2>Image produit</h2>
        <p>
          Fichier courant :{" "}
          {data.image_url
            ? "une image est enregistrée"
            : "aucune image enregistrée"}
          .
        </p>
        <ImageForm
          id={id}
          enabled={
            capabilities?.images === true && capabilities?.products === true
          }
        />
      </section>
    </div>
  );
}
