/** Contrôles STAGING seulement. Aucune migration/écriture produit/bucket/commande. */
import { createClient } from "@supabase/supabase-js";
const expected = "https://prqmomjtmyhqijysfoog.supabase.co";
const url = process.env.SHENA_STAGING_SUPABASE_URL || expected;
const key = process.env.SHENA_STAGING_SUPABASE_PUBLISHABLE_KEY;
if (url !== expected) {
  console.error("BLOQUÉ : l’URL n’est pas celle de SHENA-STAGING confirmée.");
  process.exit(2);
}
if (!key) {
  console.error(
    "BLOQUÉ : SHENA_STAGING_SUPABASE_PUBLISHABLE_KEY doit être configurée dans le gestionnaire sécurisé. Aucune connexion effectuée.",
  );
  process.exit(2);
}
if (!key.startsWith("sb_publishable_")) {
  console.error(
    "BLOQUÉ : utiliser la clé publishable staging ; aucune clé secrète n’est acceptée.",
  );
  process.exit(2);
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
  },
});
let failed = false;
const identities = new Set();
try {
  const products = await client
    .from("products")
    .select("id,active")
    .eq("active", true)
    .limit(1);
  console.log(
    JSON.stringify({
      check: "anonymous_active_products",
      ok: !products.error,
      code: products.error?.code || null,
      accessibleRows: products.data?.length ?? null,
    }),
  );
  if (products.error) {
    failed = true;
    console.log(
      "Le schéma doit être préparé et approuvé avant les tests de rôles. Aucun DDL n’est exécuté par ce script.",
    );
  }
  const features = await client.rpc("shena_catalog_features");
  console.log(
    JSON.stringify({
      check: "catalog_manifest",
      ok: !features.error,
      code: features.error?.code || null,
    }),
  );
  for (const name of ["ADMIN_A", "ADMIN_B", "CLIENT"]) {
    const email = process.env[`SHENA_STAGING_${name}_EMAIL`],
      password = process.env[`SHENA_STAGING_${name}_PASSWORD`];
    if (!email || !password) {
      console.log(
        JSON.stringify({
          check: `auth_${name.toLowerCase()}`,
          status: "not_run_missing_secure_credentials",
        }),
      );
      continue;
    }
    const scoped = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
      },
    });
    const login = await scoped.auth.signInWithPassword({ email, password });
    if (login.error) {
      failed = true;
      console.log(
        JSON.stringify({ check: `auth_${name.toLowerCase()}`, ok: false }),
      );
      continue;
    }
    const verified = await scoped.auth.getUser();
    const isAdmin = verified.data.user?.app_metadata?.shena_role === "admin";
    const expectedAdmin = name !== "CLIENT";
    const rpc = await scoped.rpc("shena_admin_status");
    const userId = verified.data.user?.id;
    const ok =
      !verified.error &&
      !!verified.data.user?.email_confirmed_at &&
      !!userId &&
      !identities.has(userId) &&
      isAdmin === expectedAdmin &&
      (expectedAdmin ? !rpc.error : !!rpc.error);
    if (userId) identities.add(userId);
    console.log(
      JSON.stringify({
        check: `auth_${name.toLowerCase()}`,
        ok,
        verifiedAdmin: isAdmin,
      }),
    );
    if (!ok) failed = true;
    await scoped.auth.signOut({ scope: "local" });
  }
  console.log(
    "Les lectures/Auth ne prouvent pas le refus SQL de TRUNCATE ni la confidentialité d’un fichier inexistant. Effectuer le protocole SQL/Storage staging approuvé séparément.",
  );
} catch {
  failed = true;
  console.error(
    "STAGING inaccessible : vérifier réseau actif, clé, état du projet. Aucun repli vers Production.",
  );
}
process.exitCode = failed ? 1 : 0;
