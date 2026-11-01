import { adminView } from "@/lib/admin/auth";
import { ProductForm } from "@/components/admin-forms";
export default async function NewProduct() {
  const context = await adminView();
  if (!context) return null;
  const { capabilities } = context;
  return (
    <section className="admin-panel">
      <h2>Nouveau produit</h2>
      <p>
        Aucune ligne ne sera créée tant que les politiques d’écriture ne sont
        pas confirmées.
      </p>
      <ProductForm enabled={capabilities?.products === true} />
    </section>
  );
}
