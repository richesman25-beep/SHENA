import { adminView } from "@/lib/admin/auth";
import { ProductEditorForm } from "@/components/admin-product-form";
export default async function NewProduct() {
  const context = await adminView();
  if (!context) return null;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">CONSTRUISEZ VOTRE CATALOGUE</span>
          <h1>Ajouter un produit</h1>
          <p>Créez un article physique, sur commande ou numérique.</p>
        </div>
      </div>
      <div className="editor-layout">
        <section className="workspace-panel">
          <h2>Informations du produit</h2>
          <ProductEditorForm
            enabled={context.capabilities?.products === true}
            draftId={crypto.randomUUID()}
          />
        </section>
        <aside className="workspace-panel editor-help">
          <h2>Un produit bien préparé</h2>
          <p>
            Enregistrez d’abord ses informations. Vous pourrez ensuite ajouter
            sa photo principale et l’associer aux catégories autorisées.
          </p>
          <p>
            Les valeurs autorisées de product_type doivent rester compatibles
            avec votre schéma existant.
          </p>
          <p>
            Les fichiers numériques payants ne doivent jamais être envoyés dans
            le bucket public d’images.
          </p>
        </aside>
      </div>
    </>
  );
}
