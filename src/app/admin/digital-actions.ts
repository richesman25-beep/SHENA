"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { normalizeProductType } from "@/lib/product-adapter";
import { validateDigitalMetadata } from "@/lib/admin/digital";
import type { ActionState } from "./actions";
export async function saveDigitalMetadataAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("digitalMetadata");
    const productId = String(form.get("id") || "");
    if (!validUuid(productId)) return { error: "Produit invalide." };
    const product = await client
      .from("products")
      .select("id,product_type")
      .eq("id", productId)
      .single();
    if (
      product.error ||
      normalizeProductType(product.data?.product_type || "") !== "digital"
    )
      return { error: "Produit numérique inaccessible." };
    const values = validateDigitalMetadata(form);
    const saved = await client
      .from("digital_product_details")
      .upsert(
        { product_id: productId, ...values },
        { onConflict: "product_id" },
      );
    if (saved.error)
      return {
        error: "Les informations numériques n’ont pas été enregistrées.",
      };
    revalidatePath("/", "layout");
    return {
      success:
        "Informations de licence, formats et compatibilité enregistrées.",
    };
  } catch {
    return { error: "Enregistrement des informations numériques refusé." };
  }
}
