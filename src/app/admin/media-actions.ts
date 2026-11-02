"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { managedObjectPath } from "@/lib/admin/storage";
import type { ActionState } from "./actions";
export async function choosePrimaryImageAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("mediaManage");
    await requireAdmin("products");
    const productId = String(form.get("product_id") || "");
    const mediaId = String(form.get("media_id") || "");
    if (!validUuid(productId) || !validUuid(mediaId))
      return { error: "Image ou produit invalide." };
    const result = await client.rpc("shena_set_primary_image", {
      p_product_id: productId,
      p_media_id: mediaId,
    });
    if (result.error)
      return {
        error:
          "L’image principale n’a pas été modifiée. Vérifiez ses dépendances et les autorisations.",
      };
    revalidatePath("/", "layout");
    return {
      success: "Image principale modifiée. Aucune image n’a été supprimée.",
    };
  } catch {
    return { error: "Changement d’image non autorisé." };
  }
}
export async function deleteUnusedImageAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("mediaDelete");
    const mediaId = String(form.get("media_id") || "");
    if (!validUuid(mediaId) || form.get("confirmed") !== "on")
      return {
        error: "Confirmez explicitement la suppression du média inutilisé.",
      };
    const media = await client
      .from("admin_media")
      .select("id,object_path,state")
      .eq("id", mediaId)
      .single();
    if (
      media.error ||
      !media.data ||
      !managedObjectPath(media.data.object_path) ||
      media.data.state !== "active"
    )
      return { error: "Ce média n’est pas supprimable par cet écran." };
    if (
      String(form.get("confirmation_name") || "") !==
      media.data.object_path.split("/").at(-1)
    )
      return { error: "Saisissez le nom exact du fichier pour confirmer." };
    // La réservation SQL verrouille le média et recontrôle tous les produits et galeries.
    const reservation = await client.rpc("shena_reserve_media_deletion", {
      p_media_id: mediaId,
    });
    if (reservation.error || typeof reservation.data !== "string")
      return {
        error:
          "Suppression refusée : ce fichier est encore utilisé ou sa suppression n’est pas autorisée.",
      };
    const removed = await client.storage
      .from("product-images")
      .remove([media.data.object_path]);
    if (removed.error)
      return {
        error:
          "La suppression n’est pas confirmée. Le média reste verrouillé pour rapprochement manuel ; aucune nouvelle association ne peut l’utiliser.",
      };
    const finalized = await client.rpc("shena_finish_media_deletion", {
      p_media_id: mediaId,
      p_token: reservation.data,
    });
    if (finalized.error)
      return {
        error:
          "Suppression Storage envoyée, mais finalisation non confirmée. Un rapprochement administrateur est requis.",
      };
    revalidatePath("/admin/medias");
    return {
      success:
        "Média inutilisé supprimé. Sa trace de gestion et d’audit est conservée.",
    };
  } catch {
    return {
      error:
        "La suppression n’a pas été confirmée. Vérifiez l’état du média avant toute nouvelle tentative.",
    };
  }
}
export async function removeProductCategoryAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("categoryLinks");
    const productId = String(form.get("product_id") || "");
    const categoryId = String(form.get("category_id") || "");
    if (
      !validUuid(productId) ||
      !validUuid(categoryId) ||
      form.get("confirmed") !== "on"
    )
      return { error: "Confirmez le retrait de l’association." };
    const result = await client.rpc("shena_remove_product_category", {
      p_product_id: productId,
      p_category_id: categoryId,
    });
    if (result.error) return { error: "L’association n’a pas été retirée." };
    revalidatePath("/", "layout");
    return { success: "Association retirée ; produit et catégorie conservés." };
  } catch {
    return { error: "Retrait d’association non autorisé." };
  }
}
