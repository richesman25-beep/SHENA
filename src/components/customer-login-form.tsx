"use client";
import { useActionState } from "react";
import { customerLoginAction } from "@/app/compte/actions";
export function CustomerLoginForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(customerLoginAction, {});
  return (
    <form action={action} className="admin-form">
      <label>
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
        />
      </label>
      <label>
        Mot de passe
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
        />
      </label>
      {state.error && (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Connexion…" : "Me connecter pour commander"}
      </button>
      <small>Aucun compte n’est créé par ce formulaire.</small>
    </form>
  );
}
