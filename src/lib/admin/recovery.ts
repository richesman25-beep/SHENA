/** Origine configurée par l'opérateur, jamais depuis un champ navigateur ou Host. */
export function trustedSiteOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function validateNewPassword(password: string, confirmation: string) {
  return (
    password.length >= 12 && password.length <= 128 && password === confirmation
  );
}

/** En Preview, une origine production héritée ne doit jamais recevoir le lien staging. */
export function trustedRecoveryOrigin(env: Record<string, string | undefined>) {
  const origin = trustedSiteOrigin(env.SHENA_SITE_URL);
  if (!origin || env.VERCEL_ENV !== "preview") return origin;
  const hosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(
    (h): h is string => !!h && /^[a-z0-9.-]+$/i.test(h),
  );
  return hosts.some((host) => origin === `https://${host}`) ? origin : null;
}
