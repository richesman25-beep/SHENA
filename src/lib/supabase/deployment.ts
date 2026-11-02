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
  if (env.VERCEL_ENV !== "preview") return;
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
