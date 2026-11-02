/** Identité publique fournie par le propriétaire ; aucune clé ni permission implicite. */
export const shenaStagingProjectRef = "prqmomjtmyhqijysfoog";
export const shenaStagingOrigin = `https://${shenaStagingProjectRef}.supabase.co`;
export type DeploymentEnvironment = {
  [name: string]: string | undefined;
  VERCEL_ENV?: string;
  SHENA_DEPLOYMENT_TARGET?: string;
  SHENA_STAGING_PROJECT_REF?: string;
  SHENA_CHECKOUT_MODE?: string;
};
export function assertPreviewIsolation(
  url: string,
  env: DeploymentEnvironment,
) {
  const declaredStaging = env.SHENA_DEPLOYMENT_TARGET === "staging";
  if (
    env.VERCEL_ENV === "production" &&
    (declaredStaging || url === shenaStagingOrigin)
  )
    throw new Error(
      "Configuration STAGING refusée sur un déploiement Production.",
    );
  if (env.VERCEL_ENV !== "preview" && !declaredStaging) return;
  if (
    env.SHENA_DEPLOYMENT_TARGET !== "staging" ||
    env.SHENA_STAGING_PROJECT_REF !== shenaStagingProjectRef ||
    url !== shenaStagingOrigin
  )
    throw new Error(
      "Preview bloquée : configurer exclusivement le projet SHENA-STAGING confirmé.",
    );
}
export function isStagingCheckout(url: string, env: DeploymentEnvironment) {
  return (
    env.VERCEL_ENV !== "production" &&
    env.SHENA_DEPLOYMENT_TARGET === "staging" &&
    env.SHENA_STAGING_PROJECT_REF === shenaStagingProjectRef &&
    env.SHENA_CHECKOUT_MODE === "staging" &&
    url === shenaStagingOrigin
  );
}

/** Activation Production explicite : ces valeurs ne sont jamais définies automatiquement. */
export const shenaProductionProjectRef = "xxadpoebcslutlevzdsy";
export const shenaProductionOrigin = `https://${shenaProductionProjectRef}.supabase.co`;
export function isProductionIdentity(url: string, env: DeploymentEnvironment) {
  return (
    env.VERCEL_ENV === "production" &&
    env.SHENA_DEPLOYMENT_TARGET === "production" &&
    url === shenaProductionOrigin
  );
}
export function isApprovedCommerce(url: string, env: DeploymentEnvironment) {
  return (
    isStagingCheckout(url, env) ||
    (isProductionIdentity(url, env) &&
      env.SHENA_CHECKOUT_MODE === "production-reviewed")
  );
}
export function isApprovedDigitalDelivery(
  url: string,
  env: DeploymentEnvironment,
) {
  return (
    isProductionIdentity(url, env) &&
    env.SHENA_DIGITAL_DOWNLOADS_MODE === "production-reviewed"
  );
}
