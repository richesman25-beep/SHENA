import { adminView } from "@/lib/admin/auth";
import { CategoryForm, AssignCategoryForm } from "@/components/admin-forms";
export default async function Categories() {
  const context = await adminView();
  if (!context) return null;
  const { client, capabilities } = context;
  if (!capabilities?.categories)
    return (
      <section className="workspace-panel">
        <h1>Gestion des catégories en attente</h1>
        <p>
          public.products ne contient aucune catégorie. Les tables categories et
          product_categories et leurs politiques sont proposées séparément.
          Aucune colonne n’est ajoutée aux requêtes products.
        </p>
        <CategoryForm enabled={false} />
      </section>
    );
  const [cats, products] = await Promise.all([
    client.from("categories").select("id,name,slug,active").order("name"),
    client.from("products").select("id,name").order("name").limit(200),
  ]);
  if (cats.error || products.error)
    return (
      <p role="alert">
        Catégories indisponibles. Vérifiez le schéma approuvé et RLS.
      </p>
    );
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">CLASSEMENT DU CATALOGUE</span>
          <h1>Catégories</h1>
          <p>Organisez les produits sans changer leur type.</p>
        </div>
      </div>
      <div className="admin-two-columns">
        <section className="workspace-panel">
          <h2>Ajouter une catégorie</h2>
          <CategoryForm enabled />
        </section>
        <section className="workspace-panel">
          <h2>Associer un produit</h2>
          <AssignCategoryForm products={products.data} categories={cats.data} />
        </section>
      </div>
      <h2>Catégories existantes</h2>
      <div className="admin-tiles">
        {cats.data.map((c) => (
          <section className="workspace-panel" key={c.id}>
            <CategoryForm category={c} enabled />
          </section>
        ))}
      </div>
    </>
  );
}
