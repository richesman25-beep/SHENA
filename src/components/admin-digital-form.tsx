"use client";
import { useActionState } from "react";
import { saveDigitalMetadataAction } from "@/app/admin/digital-actions";
export type DigitalDetails = {
  kind: string;
  formats: string[];
  license: string;
  compatibility: string;
  contents: string;
};
export function DigitalMetadataForm({
  productId,
  details,
  enabled,
}: {
  productId: string;
  details?: DigitalDetails;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveDigitalMetadataAction,
    {},
  );
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="id" value={productId} />
      <label>
        Famille de ressource
        <select name="kind" defaultValue={details?.kind || "ebook"}>
          <option value="ebook">E-book</option>
          <option value="document">Document PDF</option>
          <option value="template">Template / modèle</option>
          <option value="graphics">Ressources graphiques</option>
          <option value="software">Logiciel autorisé / archive</option>
          <option value="training">Formation numérique</option>
          <option value="planner">Planner</option>
          <option value="other">Autre ressource</option>
        </select>
      </label>
      <label>
        Formats déclarés
        <input
          name="formats"
          defaultValue={details?.formats.join(", ") || ""}
          placeholder="PDF, DOCX, ZIP…"
          maxLength={400}
        />
      </label>
      <label>
        Compatibilité
        <textarea
          name="compatibility"
          defaultValue={details?.compatibility || ""}
          maxLength={3000}
          rows={3}
        />
      </label>
      <label>
        Contenu inclus
        <textarea
          name="contents"
          defaultValue={details?.contents || ""}
          maxLength={15000}
          rows={4}
        />
      </label>
      <label>
        Conditions de licence
        <textarea
          name="license"
          defaultValue={details?.license || ""}
          maxLength={5000}
          rows={4}
          placeholder="Précisez les droits que SHENA est autorisé à céder."
        />
      </label>
      <small>
        Ces informations ne constituent ni une validation antivirus ni une
        autorisation de distribution. Les fichiers restent privés et aucun
        téléchargement payant n’est activé.
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
      <button className="button" disabled={!enabled || pending}>
        Enregistrer les informations numériques
      </button>
    </form>
  );
}
