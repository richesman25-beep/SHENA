import { validUuid } from "../admin/policy";
export class DigitalDeliveryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type DigitalRelease = {
  bucket: string;
  object_path: string;
  display_name: string;
  status: string;
};
export type DigitalDeliveryDependencies = {
  user(): Promise<{ id: string; verified: boolean } | null>;
  features(): Promise<{ version?: number; enabled?: boolean } | null>;
  release(id: string): Promise<DigitalRelease | null>;
  sign(
    path: string,
    expiresIn: number,
    downloadName: string,
  ): Promise<string | null>;
};
/** L'autorisation métier est répétée par RLS avant lecture et signature Storage. */
export async function resolveDigitalDownload(
  id: string,
  enabled: boolean,
  origin: string,
  deps: DigitalDeliveryDependencies,
) {
  if (!enabled)
    throw new DigitalDeliveryError(
      404,
      "Les téléchargements payants ne sont pas activés.",
    );
  if (!validUuid(id))
    throw new DigitalDeliveryError(404, "Fichier indisponible.");
  const user = await deps.user();
  if (!user?.id || !user.verified)
    throw new DigitalDeliveryError(
      401,
      "Connectez-vous avec un compte vérifié.",
    );
  const features = await deps.features();
  if (features?.version !== 1 || features.enabled !== true)
    throw new DigitalDeliveryError(
      403,
      "La livraison numérique n’est pas activée.",
    );
  const release = await deps.release(id);
  const parts = release?.object_path.split("/") || [];
  const validPath =
    parts.length === 3 &&
    validUuid(parts[0]) &&
    validUuid(parts[1]) &&
    parts[2].endsWith(".pdf") &&
    validUuid(parts[2].slice(0, -4));
  if (
    !release ||
    release.status !== "approved" ||
    release.bucket !== "digital-products" ||
    !validPath ||
    !release.display_name.trim() ||
    /[\r\n]/.test(release.display_name)
  )
    throw new DigitalDeliveryError(
      404,
      "Fichier non disponible pour ce compte.",
    );
  const signed = await deps.sign(release.object_path, 60, release.display_name);
  if (!signed)
    throw new DigitalDeliveryError(
      403,
      "Le fichier ne peut pas être délivré. Vérifiez le paiement auprès de la boutique.",
    );
  const url = new URL(signed);
  if (
    url.origin !== origin ||
    url.pathname !==
      `/storage/v1/object/sign/digital-products/${release.object_path}` ||
    !!url.username ||
    !!url.password ||
    !url.searchParams.get("token")
  )
    throw new DigitalDeliveryError(
      503,
      "Le lien sécurisé ne peut pas être vérifié.",
    );
  return url.href;
}
