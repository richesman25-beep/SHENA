/** Vérification locale de configuration uniquement : aucun réseau ni mutation. */
import { validateSupabaseConfig } from "../src/lib/supabase/config";
import { assertPreviewIsolation } from "../src/lib/supabase/deployment";
import { trustedRecoveryOrigin } from "../src/lib/admin/recovery";
const target = process.argv[2];
try {
  if (target !== "production" && target !== "preview")
    throw new Error("Préciser production ou preview.");
  const config = validateSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!config) throw new Error("Variables publiques Supabase manquantes.");
  const env: NodeJS.ProcessEnv = { ...process.env, VERCEL_ENV: target };
  assertPreviewIsolation(config.url, env);
  if (env.SHENA_CATALOG_MODE === "demo")
    throw new Error("La publication attend le catalogue live, pas demo.");
  if (
    target === "production" &&
    env.SHENA_CHECKOUT_MODE &&
    env.SHENA_CHECKOUT_MODE !== "disabled"
  )
    throw new Error(
      "Conserver SHENA_CHECKOUT_MODE=disabled pour cette publication.",
    );
  if (target === "preview" && !trustedRecoveryOrigin(env))
    throw new Error(
      "SHENA_SITE_URL doit correspondre à l'origine Preview Vercel vérifiée.",
    );
  console.log(
    `Configuration ${target} cohérente pour le catalogue. Aucun accès réseau effectué.`,
  );
  console.log(
    "Ce contrôle ne valide ni les droits SQL, ni Auth/Storage, ni une sauvegarde. Commandes et paiements Production restent désactivés.",
  );
} catch (error) {
  console.error(
    `Configuration bloquée : ${error instanceof Error ? error.message : "erreur"}`,
  );
  process.exitCode = 2;
}
