"use client";
import { useActionState } from "react";
import {
  loginAction,
  saveCategoryAction,
  assignCategoryAction,
  uploadDigitalAction,
  type ActionState,
} from "@/app/admin/actions";

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
  extended = false,
}: {
  extended?: boolean;
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
        Fichier numérique privé
        <input
          name="file"
          type="file"
          accept={
            extended ? ".pdf,.zip,.docx,.xlsx,.pptx,.epub" : "application/pdf"
          }
          required
        />
      </label>
      <small>
        {extended
          ? "PDF, ZIP, DOCX, XLSX, PPTX ou EPUB · 2 Mo maximum. La signature est contrôlée, mais la validation complète et l’analyse antivirus restent nécessaires. Les archives ne sont jamais décompressées par cette application."
          : "PDF uniquement · 2 Mo maximum. Les autres formats restent verrouillés tant que les nouvelles permissions ne sont pas confirmées."}{" "}
        Aucun lien de téléchargement client n’est généré.
      </small>
      <Result state={state} />
      <button
        className="button"
        disabled={!enabled || pending || !products.length}
      >
        Placer le fichier en quarantaine privée
      </button>
    </form>
  );
}
