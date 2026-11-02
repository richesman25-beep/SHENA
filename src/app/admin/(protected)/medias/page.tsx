import Image from "next/image";
import Link from "next/link";
import { adminView } from "@/lib/admin/auth";
import { safeStoragePrefix, type ManagedMedia } from "@/lib/admin/storage";
import { safeImageUrl } from "@/lib/product-adapter";
import { DeleteMediaForm } from "@/components/admin-media-forms";
export default async function Media({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await adminView();
  if (!context) return null;
  const query = await searchParams;
  const prefix = safeStoragePrefix(
    typeof query.prefix === "string" ? query.prefix : "",
  );
  if (prefix === null)
    return (
      <section className="workspace-panel">
        <h1>Chemin de médias invalide</h1>
        <Link href="/admin/medias">Retour aux médias</Link>
      </section>
    );
  let managed: ManagedMedia[] = [];
  if (context.capabilities?.mediaManage) {
    const result = await context.client
      .from("admin_media")
      .select("id,object_path,public_url,size_bytes,state,created_at")
      .neq("state", "deleted")
      .limit(1000);
    if (!result.error) managed = result.data as ManagedMedia[];
  }
  const listing = context.capabilities?.images
    ? await context.client.storage.from("product-images").list(prefix, {
        limit: 100,
        offset: Math.max(0, Math.floor(Number(query.page) || 0)) * 100,
        sortBy: { column: "name", order: "asc" },
      })
    : null;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">VOS VISUELS DE BOUTIQUE</span>
          <h1>Médias</h1>
          <p>
            Images du bucket public product-images. Aucun fichier numérique
            payant n’est listé ici.
          </p>
        </div>
        <Link className="button" href="/admin/products">
          Ajouter une image à un produit
        </Link>
      </div>
      <section className="workspace-panel">
        <div className="media-breadcrumb">
          <Link href="/admin/medias">Tous les dossiers</Link>
          {prefix && <span>/ {prefix}</span>}
        </div>
        {!listing ? (
          <div className="admin-empty">
            <h2>Gestion des images en attente d’autorisation</h2>
            <p>
              Les permissions Storage de ce compte doivent être confirmées.
              Aucune lecture privée ni suppression n’est tentée.
            </p>
          </div>
        ) : listing.error ? (
          <p className="admin-error" role="alert">
            Le bucket ne peut pas être parcouru. Vérifiez sa disponibilité et
            les permissions SELECT.
          </p>
        ) : !listing.data.length ? (
          <div className="admin-empty">
            <h2>Ce dossier ne contient aucun média accessible.</h2>
            <p>Les fichiers non autorisés ne sont pas affichés.</p>
          </div>
        ) : (
          <div className="admin-media-grid">
            {listing.data.map((entry) => {
              const path = [prefix, entry.name].filter(Boolean).join("/");
              if (entry.id === null)
                return (
                  <Link
                    className="media-folder"
                    href={"/admin/medias?prefix=" + encodeURIComponent(path)}
                    key={path}
                  >
                    <span>▱</span>
                    <strong>{entry.name}</strong>
                    <small>Ouvrir le dossier →</small>
                  </Link>
                );
              const record = managed.find((m) => m.object_path === path);
              const imageUrl = context.client.storage
                .from("product-images")
                .getPublicUrl(path).data.publicUrl;
              const isImage =
                /\.(png|jpe?g|webp)$/i.test(entry.name) &&
                safeImageUrl(imageUrl);
              return (
                <article className="managed-media-card" key={path}>
                  {isImage ? (
                    <Image
                      src={imageUrl}
                      alt={entry.name}
                      width={400}
                      height={260}
                      unoptimized
                    />
                  ) : (
                    <div className="media-file-placeholder">
                      Aperçu indisponible
                    </div>
                  )}
                  <div>
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.metadata?.size
                        ? `${Math.round(Number(entry.metadata.size) / 1024)} Ko`
                        : "Taille non renseignée"}{" "}
                      · Image publique
                    </small>
                    {record ? (
                      <>
                        <span className="media-state">
                          {record.state === "active"
                            ? "Média géré"
                            : record.state === "deleting"
                              ? "Suppression verrouillée — à rapprocher"
                              : "État à vérifier"}
                        </span>
                        {context.capabilities?.mediaDelete &&
                          record.state === "active" && (
                            <DeleteMediaForm
                              mediaId={record.id}
                              fileName={entry.name}
                            />
                          )}
                      </>
                    ) : (
                      <p className="admin-muted">
                        Média existant non enregistré dans le nouveau registre.
                        Sa suppression reste verrouillée.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {listing && !listing.error && (
          <nav className="admin-pagination">
            {Number(query.page) > 0 && (
              <Link
                href={
                  "/admin/medias?prefix=" +
                  encodeURIComponent(prefix) +
                  "&page=" +
                  String(Math.max(0, Number(query.page) - 1))
                }
              >
                ← Précédent
              </Link>
            )}
            {listing.data.length === 100 && (
              <Link
                href={
                  "/admin/medias?prefix=" +
                  encodeURIComponent(prefix) +
                  "&page=" +
                  String((Number(query.page) || 0) + 1)
                }
              >
                Suivant →
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
