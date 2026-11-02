"use client";
import Link from "next/link";
import { useActionState, useState, useEffect } from "react";
import Image from "next/image";
import {
  saveProductAction,
  setPublicationAction,
  uploadImageAction,
  type ActionState,
} from "@/app/admin/actions";
import { productRevision } from "@/lib/admin/products";
import { normalizeProductType } from "@/lib/product-adapter";
import type { ExistingProduct } from "@/lib/supabase/config";
type EditorProps = {
  product?: ExistingProduct;
  enabled: boolean;
  draftId?: string;
};
export function ProductEditorForm(props: EditorProps) {
  const [state, action, pending] = useActionState(saveProductAction, {});
  return (
    <ProductEditorFields
      key={props.product ? productRevision(props.product) : props.draftId}
      {...props}
      state={state}
      action={action}
      pending={pending}
    />
  );
}
function ProductEditorFields({
  product,
  enabled,
  draftId,
  state,
  action,
  pending,
}: EditorProps & {
  state: ActionState;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  const [active, setActive] = useState(product?.active ?? false);
  const [type, setType] = useState(product?.product_type || "physical");
  const logicalType = normalizeProductType(type);
  const visibilityChanged = !!product && product.active !== active;
  return (
    <form action={action} className="admin-form product-editor-form">
      <input name="id" type="hidden" value={product?.id || ""} />
      <input name="request_id" type="hidden" value={draftId || ""} />
      <input
        name="revision"
        type="hidden"
        value={product ? productRevision(product) : ""}
      />
      <label>
        Nom du produit
        <input
          name="name"
          required
          maxLength={160}
          defaultValue={product?.name}
          placeholder="Le nom affiché dans la boutique"
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          maxLength={15000}
          rows={7}
          defaultValue={product?.description || ""}
          placeholder="Caractéristiques, contenu et informations utiles…"
        />
      </label>
      <div className="form-columns">
        <label>
          Prix en HTG
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
          Devise
          <input
            value="HTG — Gourde haïtienne"
            readOnly
            aria-describedby="currency-explanation"
          />
        </label>
      </div>
      <small id="currency-explanation">
        Le prix est enregistré dans la colonne existante price_htg. Aucune
        conversion monétaire n’est supposée.
      </small>
      <div className="form-columns">
        <label>
          Type de produit
          <select
            name="product_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
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
            <option value="physical">Physique en stock</option>
            <option value="digital">Numérique</option>
            <option value="preorder">Physique sur commande</option>
          </select>
        </label>
        <label>
          Stock global
          {logicalType === "digital" || logicalType === "preorder" ? (
            <>
              <input value="Non applicable" readOnly />
              <input type="hidden" name="stock" value="0" />
            </>
          ) : (
            <input
              name="stock"
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
              defaultValue={product ? (product.stock ?? "") : 0}
            />
          )}
        </label>
      </div>
      <div className="publication-choice">
        <label className="admin-check">
          <input
            name="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Publier ce produit dans la boutique
        </label>
        <p>
          {active
            ? "Le produit actif sera visible selon les politiques publiques Supabase."
            : "Le produit sera conservé sans publication dans le catalogue public."}
        </p>
        {visibilityChanged && (
          <label className="admin-check">
            <input name="confirm_visibility" type="checkbox" required />
            Je confirme le changement de publication.
          </label>
        )}
      </div>
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
      <div className="form-save-row">
        <button
          className="button"
          disabled={!enabled || pending || !!state.productId}
        >
          {pending
            ? "Enregistrement…"
            : product
              ? "Enregistrer les modifications"
              : "Créer le produit"}
        </button>
        <Link href="/admin/products">Retour aux produits</Link>
      </div>
      {state.productId && (
        <Link
          className="admin-success-link"
          href={`/admin/products/${state.productId}`}
        >
          Ouvrir le produit créé →
        </Link>
      )}
      {!enabled && (
        <small className="permission-explanation">
          Écriture non autorisée par les capacités Supabase disponibles. Aucun
          enregistrement ne sera tenté.
        </small>
      )}
    </form>
  );
}
export function PublicationForm({
  product,
  enabled,
}: {
  product: ExistingProduct;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(setPublicationAction, {});
  return (
    <form action={action} className="admin-form publication-form">
      <input name="id" value={product.id} type="hidden" />
      <input name="revision" value={productRevision(product)} type="hidden" />
      <input
        name="target_active"
        value={String(!product.active)}
        type="hidden"
      />
      <p>
        {product.active
          ? "Dépublier retire le produit du catalogue sans supprimer ses données, images ou associations."
          : "La publication rend le produit visible dans le catalogue public selon RLS."}
      </p>
      <label>
        Confirmer le nom du produit
        <input
          name="confirmation_name"
          required
          autoComplete="off"
          placeholder={product.name}
        />
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
      <button
        className={`button ${product.active ? "button-caution" : ""}`}
        disabled={!enabled || pending}
      >
        {pending
          ? "Mise à jour…"
          : product.active
            ? "Dépublier / archiver du catalogue"
            : "Publier le produit"}
      </button>
    </form>
  );
}
export function ProductImageUpload({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadImageAction, {});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <form action={action} className="admin-form image-upload-form">
      <input name="id" value={id} type="hidden" />
      <label>
        Nouvelle image
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => {
            const selected = e.target.files?.[0] || null;
            setFile(selected);
            setPreview(selected ? URL.createObjectURL(selected) : "");
          }}
        />
      </label>
      {file && (
        <div className="upload-preview">
          {preview && (
            <Image
              src={preview}
              alt="Aperçu local avant téléversement"
              width={360}
              height={240}
              unoptimized
            />
          )}
          <span>
            {file.name} · {(file.size / 1024).toFixed(0)} Ko
          </span>
          {file.size > 2 * 1024 * 1024 && (
            <p role="alert">Cette image dépasse la limite de 2 Mo.</p>
          )}
        </div>
      )}
      <small>
        JPEG, PNG ou WebP · 2 Mo maximum. La signature et les dimensions sont
        contrôlées puis le fichier est converti en WebP côté serveur. L’ancienne
        image reste conservée.
      </small>
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
      <button
        className="button"
        disabled={
          !enabled || pending || (!!file && file.size > 2 * 1024 * 1024)
        }
      >
        {pending
          ? "Traitement de l’image…"
          : "Téléverser et choisir comme image principale"}
      </button>
    </form>
  );
}
