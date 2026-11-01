"use client";
import { useActionState } from "react";
import {
  loginAction,
  saveProductAction,
  uploadImageAction,
  saveCategoryAction,
  assignCategoryAction,
  uploadDigitalAction,
  type ActionState,
} from "@/app/admin/actions";
import type { ExistingProduct } from "@/lib/supabase/config";

function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="admin-success">
          {state.success}
        </p>
      )}
    </>
  );
}
export function LoginForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="admin-form">
      <label>
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Mot de passe
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
        />
      </label>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <small>
        Seuls les comptes existants explicitement autorisés côté serveur sont
        acceptés. Aucun compte n’est créé ici.
      </small>
    </form>
  );
}
export function ProductForm({
  product,
  enabled,
}: {
  product?: ExistingProduct;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveProductAction, {});

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="id" value={product?.id || ""} />
      <label>
        Nom
        <input
          name="name"
          defaultValue={product?.name}
          required
          maxLength={160}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={product?.description || ""}
          maxLength={15000}
          rows={5}
        />
      </label>
      <label>
        Type
        <select
          name="product_type"
          defaultValue={product?.product_type || "physical"}
          required
        >
          {product &&
            !["physical", "digital", "preorder"].includes(
              product.product_type,
            ) && (
              <option value={product.product_type}>
                Valeur existante : {product.product_type}
              </option>
            )}
          <option value="" disabled>
            Type existant à vérifier
          </option>
          <option value="physical">Physique en stock</option>
          <option value="preorder">Sur commande</option>
          <option value="digital">Numérique</option>
        </select>
      </label>
      <label>
        Prix HTG
        <input
          name="price_htg"
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          required
          defaultValue={product?.price_htg}
        />
      </label>
      <label>
        Stock global
        <input
          name="stock"
          type="number"
          min="0"
          max="1000000"
          step="1"
          required
          defaultValue={product ? (product.stock ?? "") : 0}
        />
      </label>
      <label className="admin-check">
        <input
          name="active"
          type="checkbox"
          defaultChecked={product?.active ?? false}
        />
        Produit actif (visible au public)
      </label>
      <small>
        Numérique et sur commande : stock physique fixé à zéro. Prix et type
        existants sont à vérifier avant enregistrement. Les variantes et
        emplacements demandent un schéma approuvé.
      </small>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Enregistrement…" : "Enregistrer le produit"}
      </button>
      {!enabled && (
        <p>Écriture verrouillée : politiques administrateur non confirmées.</p>
      )}
    </form>
  );
}
export function ImageForm({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(uploadImageAction, {});
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="id" value={id} />
      <label>
        Image du produit
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <small>
        JPEG, PNG ou WebP, 2 Mo maximum. Décodage, limite de pixels, suppression
        des métadonnées et conversion WebP côté serveur. Pas de SVG. Les
        anciennes images sont conservées.
      </small>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Traitement…" : "Téléverser et associer l’image"}
      </button>
    </form>
  );
}
export function CategoryForm({
  enabled,
  category,
}: {
  enabled: boolean;
  category?: { id: string; name: string; slug: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveCategoryAction, {});
  return (
    <form className="admin-form" action={action}>
      <input name="id" type="hidden" value={category?.id || ""} />
      <label>
        Nom de catégorie
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={category?.name}
        />
      </label>
      <label>
        Slug
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={80}
          defaultValue={category?.slug}
        />
      </label>
      <label className="admin-check">
        <input
          type="checkbox"
          name="active"
          defaultChecked={category?.active ?? true}
        />
        Catégorie active
      </label>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        Enregistrer la catégorie
      </button>
    </form>
  );
}
export function AssignCategoryForm({
  products,
  categories,
}: {
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(assignCategoryAction, {});
  return (
    <form action={action} className="admin-form">
      <label>
        Produit
        <select name="product_id" required>
          {products.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Catégorie
        <select name="category_id" required>
          {categories.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Result state={state} />
      <button
        className="button"
        disabled={pending || !products.length || !categories.length}
      >
        Associer la catégorie
      </button>
    </form>
  );
}
export function DigitalFileForm({
  products,
  enabled,
}: {
  products: { id: string; name: string }[];
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadDigitalAction, {});
  return (
    <form action={action} className="admin-form">
      <label>
        Produit numérique
        <select name="id" required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fichier PDF privé
        <input name="file" type="file" accept="application/pdf" required />
      </label>
      <small>
        2 Mo maximum, quarantaine privée exclusivement. Les formats ZIP, Canva,
        Word et Excel seront ajoutés après définition d’une analyse antivirus
        appropriée. Aucun lien de téléchargement client n’est généré.
      </small>
      <Result state={state} />
      <button
        className="button"
        disabled={!enabled || pending || !products.length}
      >
        Placer le PDF en quarantaine privée
      </button>
    </form>
  );
}
