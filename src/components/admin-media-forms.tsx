"use client";
import { useActionState } from "react";
import {
  choosePrimaryImageAction,
  deleteUnusedImageAction,
  removeProductCategoryAction,
} from "@/app/admin/media-actions";
export function PrimaryImageForm({
  productId,
  mediaId,
}: {
  productId: string;
  mediaId: string;
}) {
  const [state, action, pending] = useActionState(choosePrimaryImageAction, {});
  return (
    <form action={action} className="media-inline-form">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="media_id" value={mediaId} />
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
      <button disabled={pending}>
        {pending ? "Mise à jour…" : "Choisir comme image principale"}
      </button>
    </form>
  );
}
export function DeleteMediaForm({
  mediaId,
  fileName,
}: {
  mediaId: string;
  fileName: string;
}) {
  const [state, action, pending] = useActionState(deleteUnusedImageAction, {});
  return (
    <details className="delete-media-disclosure">
      <summary>Supprimer ce média inutilisé</summary>
      <form action={action} className="admin-form">
        <input type="hidden" name="media_id" value={mediaId} />
        <p>
          Cette action ne vise que ce fichier géré. Le serveur refusera sa
          suppression s’il est encore associé à un produit, même inactif.
        </p>
        <label>
          Nom exact du fichier
          <input
            name="confirmation_name"
            required
            placeholder={fileName}
            autoComplete="off"
          />
        </label>
        <label className="admin-check">
          <input type="checkbox" name="confirmed" required />
          Je confirme la suppression de ce fichier inutilisé.
        </label>
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
        <button className="button button-caution" disabled={pending}>
          Confirmer la suppression
        </button>
      </form>
    </details>
  );
}
export function RemoveCategoryForm({
  productId,
  categoryId,
}: {
  productId: string;
  categoryId: string;
}) {
  const [state, action, pending] = useActionState(
    removeProductCategoryAction,
    {},
  );
  return (
    <form action={action} className="remove-category-form">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="category_id" value={categoryId} />
      <label>
        <input type="checkbox" name="confirmed" required />
        Confirmer le retrait
      </label>
      <button disabled={pending}>Retirer l’association</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
