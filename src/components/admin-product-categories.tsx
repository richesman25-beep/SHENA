import { adminView } from "@/lib/admin/auth";
import { AssignCategoryForm } from "./admin-forms";
import { RemoveCategoryForm } from "./admin-media-forms";
export async function ProductCategoryPanel({
  productId,
}: {
  productId: string;
}) {
  const context = await adminView();
  if (!context) return null;
  if (!context.capabilities?.categories)
    return (
      <section className="workspace-panel">
        <h2>Catégories</h2>
        <p className="admin-muted">
          Les catégories ne figurent pas dans la table products existante. Leur
          association restera indisponible tant que les structures et
          autorisations ne sont pas confirmées.
        </p>
      </section>
    );
  const [cats, links, product] = await Promise.all([
    context.client
      .from("categories")
      .select("id,name,slug,active")
      .order("name"),
    context.client
      .from("product_categories")
      .select("category_id")
      .eq("product_id", productId),
    context.client
      .from("products")
      .select("id,name")
      .eq("id", productId)
      .single(),
  ]);
  if (cats.error || links.error || product.error)
    return (
      <section className="workspace-panel">
        <h2>Catégories</h2>
        <p role="alert" className="admin-error">
          Les associations n’ont pas pu être chargées.
        </p>
      </section>
    );
  const attached = cats.data.filter((c) =>
    links.data.some((l) => l.category_id === c.id),
  );
  return (
    <section className="workspace-panel">
      <h2>Catégories du produit</h2>
      {attached.length ? (
        <ul className="attached-categories">
          {attached.map((c) => (
            <li key={c.id}>
              <span>
                {c.name}
                {!c.active && " — non publiée"}
              </span>
              {context.capabilities?.categoryLinks && (
                <RemoveCategoryForm productId={productId} categoryId={c.id} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-muted">Aucune catégorie associée.</p>
      )}
      <AssignCategoryForm
        products={[product.data]}
        categories={cats.data.filter((c) => c.active)}
      />
    </section>
  );
}
