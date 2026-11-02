import Image from "next/image";
import { adminView } from "@/lib/admin/auth";
import { safeImageUrl } from "@/lib/product-adapter";
import type { ExistingProduct } from "@/lib/supabase/config";
import type { ManagedMedia } from "@/lib/admin/storage";
import { PrimaryImageForm } from "./admin-media-forms";
export async function ProductMediaPanel({
  product,
}: {
  product: ExistingProduct;
}) {
  const context = await adminView();
  if (!context) return null;
  const main = safeImageUrl(product.image_url);
  let gallery: ManagedMedia[] = [];
  let unavailable = false;
  if (context.capabilities?.mediaManage) {
    const links = await context.client
      .from("product_media")
      .select("media_id,position")
      .eq("product_id", product.id)
      .order("position");
    if (links.error) unavailable = true;
    else if (links.data.length) {
      const result = await context.client
        .from("admin_media")
        .select("id,object_path,public_url,size_bytes,state,created_at")
        .in(
          "id",
          links.data.map((l) => l.media_id),
        );
      if (result.error) unavailable = true;
      else
        gallery = links.data.flatMap((link) => {
          const m = result.data.find((m) => m.id === link.media_id);
          return m ? [m as ManagedMedia] : [];
        });
    }
  }
  return (
    <div className="product-media-panel">
      {main ? (
        <div className="current-main-image">
          <Image
            src={main}
            alt={`Image principale : ${product.name}`}
            width={500}
            height={350}
            unoptimized
          />
          <span>Image principale actuelle</span>
        </div>
      ) : (
        <p className="admin-muted">
          Aucune image principale publique renseignée.
        </p>
      )}
      {unavailable && (
        <p role="alert" className="admin-error">
          La galerie n’a pas pu être chargée.
        </p>
      )}
      {gallery.length > 0 && (
        <div className="editor-gallery">
          {gallery.map((m) => (
            <div key={m.id}>
              {safeImageUrl(m.public_url) && m.state === "active" ? (
                <Image
                  src={m.public_url}
                  alt="Image de galerie"
                  width={160}
                  height={120}
                  unoptimized
                />
              ) : (
                <span>Média indisponible</span>
              )}
              {m.public_url === product.image_url ? (
                <span className="publication-status published">Principale</span>
              ) : (
                m.state === "active" && (
                  <PrimaryImageForm productId={product.id} mediaId={m.id} />
                )
              )}
            </div>
          ))}
        </div>
      )}
      {!context.capabilities?.mediaManage && (
        <p className="admin-muted">
          L’image principale fonctionne avec le schéma existant. Les galeries et
          suppressions contrôlées nécessitent les autorisations de gestion des
          médias.
        </p>
      )}
    </div>
  );
}
