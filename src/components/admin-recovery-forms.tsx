"use client";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  changePasswordAction,
} from "@/app/admin/recovery-actions";
export function PasswordResetRequestForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    {},
  );
  return (
    <form action={action} className="admin-form">
      <label>
        E-mail du compte
        <input
          name="email"
          type="email"
          maxLength={254}
          autoComplete="email"
          required
        />
      </label>
      {state.error && (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="admin-success" role="status">
          {state.success}
        </p>
      )}
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Envoi en cours…" : "Recevoir un lien de récupération"}
      </button>
      <small>
        La récupération d’un mot de passe n’attribue aucun privilège
        administrateur.
      </small>
    </form>
  );
}
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <form action={action} className="admin-form">
      <label>
        Nouveau mot de passe
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirmer le mot de passe
        <input
          name="confirmation"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <small>
        Entre 12 et 128 caractères. Utilisez un mot de passe unique pour votre
        compte personnel.
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
      <button className="button" disabled={pending}>
        Enregistrer le mot de passe
      </button>
    </form>
  );
}
