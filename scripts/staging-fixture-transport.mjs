/** Préchargement du processus de test seulement. Aucun import dans l'application. */
const stage = "https://prqmomjtmyhqijysfoog.supabase.co";
const target = process.env.SHENA_FIXTURE_API_ORIGIN;
if (!target || !/^https:\/\/localhost:\d+$/.test(target))
  throw new Error("Transport de test : origine locale HTTPS requise.");
const native = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const original = new URL(
    input instanceof Request ? input.url : String(input),
  );
  if (original.origin === stage) {
    const mapped = target + original.pathname + original.search;
    return native(
      input instanceof Request ? new Request(mapped, input) : mapped,
      init,
    );
  }
  if (!["127.0.0.1", "localhost"].includes(original.hostname))
    throw new Error(
      "Réseau externe interdit dans le processus d’intégration local.",
    );
  return native(input, init);
};
