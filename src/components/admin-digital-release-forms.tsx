"use client";
import { useActionState } from "react";
import {
  prepareDigitalReleaseAction,
  reviewDigitalReleaseAction,
  inspectDigitalReleaseAction,
  type ReleaseActionState,
} from "@/app/admin/digital-release-actions";
function Result({ state }: { state: ReleaseActionState }) {
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
      {state.url && (
        <a
          href={state.url}
          rel="noreferrer"
          className="button button-secondary"
        >
          Télécharger pour contrôle
        </a>
      )}
    </>
  );
}
export function PrepareDigitalReleaseForm({
  assets,
}: {
  assets: { id: string; original_name: string }[];
}) {
  const [state, action, pending] = useActionState(
    prepareDigitalReleaseAction,
    {},
  );
  return (
    <form action={action} className="admin-form">
      <h2>Préparer une version contrôlée</h2>
      <label>
        PDF en quarantaine
        <select name="asset_id" required>
          <option value="">Sélectionner un fichier</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.original_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        SHA256 correspondant au rapport d’analyse
        <input
          name="sha256"
          required
          pattern="[a-fA-F0-9]{64}"
          maxLength={64}
        />
      </label>
      <label>
        Référence du rapport et contrôles effectués
        <textarea
          name="security_report"
          minLength={10}
          maxLength={2000}
          required
        />
      </label>
      <label>
        <input name="confirmed" type="checkbox" required />
        J’ai contrôlé le fichier et son rapport de sécurité. Aucun antivirus
        automatique n’est simulé.
      </label>
      <Result state={state} />
      <button className="button" disabled={pending || !assets.length}>
        {pending ? "Vérification…" : "Préparer la copie privée"}
      </button>
    </form>
  );
}
export function ReviewDigitalReleaseForm({
  id,
  self,
  status,
}: {
  id: string;
  self: boolean;
  status: string;
}) {
  const [state, action, pending] = useActionState(
    reviewDigitalReleaseAction,
    {},
  );
  const [inspection, inspect, inspecting] = useActionState(
    inspectDigitalReleaseAction,
    {},
  );
  return (
    <>
      <form action={inspect}>
        <input type="hidden" name="release_id" value={id} />
        <button disabled={inspecting}>Obtenir un lien privé de contrôle</button>
        <Result state={inspection} />
      </form>
      <form action={action} className="admin-form">
        <input type="hidden" name="release_id" value={id} />
        <label>
          Décision
          <select name="decision">
            <option value="approved" disabled={self || status !== "pending"}>
              Approuver après contrôle indépendant
            </option>
            <option value="revoked">Révoquer la version</option>
          </select>
        </label>
        <label>
          Compte rendu
          <textarea name="note" minLength={10} maxLength={1000} required />
        </label>
        <label>
          <input type="checkbox" name="confirmed" required />
          Je confirme le contrôle et cette décision.
        </label>
        <Result state={state} />
        <button disabled={pending || status === "revoked"}>
          Enregistrer la décision
        </button>
      </form>
    </>
  );
}
