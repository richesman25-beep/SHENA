"use server";
import { redirect } from "next/navigation";
import { commerceContext } from "@/lib/commerce/server";
export async function customerLoginAction(
  _previous: { error?: string },
  form: FormData,
): Promise<{ error?: string }> {
  try {
    const context = await commerceContext();
    if (!context?.capabilities.orders)
      return {
        error:
          "L’accès aux commandes n’est pas encore activé sur cet environnement.",
      };
    const email = String(form.get("email") || "").trim(),
      password = String(form.get("password") || "");
    if (!email || email.length > 254 || !password || password.length > 1024)
      return { error: "Renseignez votre e-mail et votre mot de passe." };
    const signed = await context.client.auth.signInWithPassword({
      email,
      password,
    });
    if (signed.error)
      return { error: "Connexion refusée. Vérifiez vos identifiants." };
    const user = await context.client.auth.getUser();
    if (user.error || !user.data.user?.email_confirmed_at) {
      await context.client.auth.signOut();
      return { error: "Un compte client avec e-mail vérifié est nécessaire." };
    }
  } catch {
    return { error: "Le service de connexion est momentanément indisponible." };
  }
  redirect("/commander");
}
export async function customerLogoutAction() {
  const context = await commerceContext();
  await context?.client.auth.signOut();
  redirect("/compte/connexion");
}
