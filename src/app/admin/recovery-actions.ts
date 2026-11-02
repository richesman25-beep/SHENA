"use server";
import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { trustedSiteOrigin, validateNewPassword } from "@/lib/admin/recovery";
import type { ActionState } from "./actions";
export async function requestPasswordResetAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = String(form.get("email") || "").trim();
  if (email.length > 254 || !email.includes("@"))
    return { error: "Renseignez une adresse e-mail valide." };
  const origin = trustedSiteOrigin(process.env.SHENA_SITE_URL);
  if (!origin)
    return {
      error:
        "La récupération doit être configurée par le responsable du site avant de pouvoir envoyer un lien.",
    };
  try {
    const client = await sessionClient();
    if (!client)
      return { error: "Le service d’authentification n’est pas configuré." };
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: origin + "/admin/auth/callback",
    });
  } catch {
    /* Réponse uniforme : ne pas révéler les comptes existants. */
  }
  return {
    success:
      "Si cette adresse correspond à un compte, un e-mail de récupération lui sera envoyé. Vérifiez votre boîte de réception et les courriers indésirables.",
  };
}
export async function changePasswordAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const password = String(form.get("password") || "");
  const confirmation = String(form.get("confirmation") || "");
  if (!validateNewPassword(password, confirmation))
    return {
      error:
        "Utilisez entre 12 et 128 caractères et confirmez le même mot de passe.",
    };
  try {
    const { client } = await requireAdmin();
    const { error } = await client.auth.updateUser({ password });
    if (error)
      return {
        error:
          "Le mot de passe n’a pas pu être modifié. Demandez un nouveau lien si votre session a expiré.",
      };
    const signout = await client.auth.signOut({ scope: "global" });
    if (signout.error)
      return {
        success:
          "Mot de passe modifié. Déconnectez-vous et vérifiez vos sessions dans les paramètres de sécurité.",
      };
  } catch {
    return {
      error:
        "Votre session administrateur n’est pas valide. Reconnectez-vous ou demandez un nouveau lien.",
    };
  }
  redirect("/admin/connexion?password=updated");
}
