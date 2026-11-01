"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sessionClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  hasAdminRole,
  validateProductForm,
  validUuid,
} from "@/lib/admin/policy";
import { existingProductColumns } from "@/lib/supabase/config";
import { processProductImage } from "@/lib/admin/media";
import { normalizeProductType } from "@/lib/product-adapter";
export type ActionState = { error?: string; success?: string };
export async function loginAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || email.length > 254 || !password || password.length > 1024)
    return { error: "Renseignez votre adresse e-mail et votre mot de passe." };
  try {
    const client = await sessionClient();
    if (!client)
      return { error: "La connexion Supabase n’est pas configurée." };
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error)
      return { error: "Connexion refusée. Vérifiez vos identifiants." };
    const verified = await client.auth.getUser();
    if (verified.error || !hasAdminRole(verified.data.user)) {
      await client.auth.signOut();
      return { error: "Ce compte n’est pas autorisé pour l’administration." };
    }
  } catch {
    return { error: "Le service d’authentification est indisponible." };
  }
  redirect("/admin");
}
export async function logoutAction() {
  const client = await sessionClient();
  await client?.auth.signOut();
  redirect("/admin/connexion");
}
export async function saveProductAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("products");

    const id = String(form.get("id") || "");
    if (id && !validUuid(id)) return { error: "Identifiant invalide." };
    let existingType: string | undefined;
    if (id) {
      const current = await client
        .from("products")
        .select("product_type")
        .eq("id", id)
        .single();
      if (current.error) return { error: "Produit inaccessible." };
      existingType = current.data.product_type;
    }
    const values = validateProductForm(form, existingType);
    // Aucune colonne inconnue, aucun rôle service : le JWT utilisateur reste soumis à RLS.
    const result = id
      ? await client
          .from("products")
          .update(values)
          .eq("id", id)
          .select("id")
          .single()
      : await client.from("products").insert(values).select("id").single();
    if (result.error)
      return {
        error:
          "Enregistrement refusé par la base. Vérifiez les politiques, contraintes et types autorisés.",
      };
    revalidatePath("/", "layout");
    return { success: "Produit enregistré dans Supabase." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Enregistrement indisponible.",
    };
  }
}
export async function uploadImageAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client, userId } = await requireAdmin("images");
    await requireAdmin("products");
    const id = String(form.get("id") || "");
    if (!validUuid(id)) return { error: "Produit invalide." };
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return {
        error: "Utilisez une image JPEG, PNG ou WebP, de 2 Mo maximum.",
      };
    const { data: product, error } = await client
      .from("products")
      .select("id")
      .eq("id", id)
      .single();
    if (error || !product) return { error: "Produit inaccessible." };
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await processProductImage(buffer);
    const path = `${userId}/${id}/${crypto.randomUUID()}.webp`;
    const upload = await client.storage
      .from("product-images")
      .upload(path, image, { contentType: "image/webp", upsert: false });
    if (upload.error)
      return {
        error:
          "Téléversement refusé. Le bucket et ses politiques doivent être approuvés.",
      };
    const image_url = client.storage.from("product-images").getPublicUrl(path)
      .data.publicUrl;
    const update = await client
      .from("products")
      .update({ image_url })
      .eq("id", id)
      .select("id")
      .single();
    if (update.error)
      return {
        error:
          "Image stockée mais association refusée. Le fichier reste à examiner dans Storage ; aucune ancienne image n’a été supprimée.",
      };
    revalidatePath("/", "layout");
    return { success: "Image convertie en WebP et associée au produit." };
  } catch {
    return {
      error:
        "Image non valide ou opération non autorisée. Aucun fichier existant n’a été remplacé.",
    };
  }
}
export async function saveCategoryAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("categories");
    const name = String(form.get("name") || "").trim();
    const slug = String(form.get("slug") || "").trim();
    const id = String(form.get("id") || "");
    if (
      !name ||
      name.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 80 ||
      (id && !validUuid(id))
    )
      return { error: "Nom ou slug invalide." };
    const values = { name, slug, active: form.get("active") === "on" };
    const result = id
      ? await client
          .from("categories")
          .update(values)
          .eq("id", id)
          .select("id")
          .single()
      : await client.from("categories").insert(values).select("id").single();
    if (result.error)
      return {
        error:
          "Catégorie non enregistrée. Vérifiez les contraintes et politiques.",
      };
    revalidatePath("/", "layout");
    return { success: "Catégorie enregistrée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Accès refusé." };
  }
}
export async function assignCategoryAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("categories");
    const product_id = String(form.get("product_id") || "");
    const category_id = String(form.get("category_id") || "");
    if (!validUuid(product_id) || !validUuid(category_id))
      return { error: "Identifiants invalides." };
    const result = await client
      .from("product_categories")
      .upsert(
        { product_id, category_id },
        { onConflict: "product_id,category_id" },
      );
    if (result.error) return { error: "Association refusée." };
    revalidatePath("/", "layout");
    return { success: "Catégorie associée." };
  } catch {
    return { error: "Opération non autorisée ou structure manquante." };
  }
}
export async function uploadDigitalAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client, userId } = await requireAdmin("digital");
    const productId = String(form.get("id") || "");
    const file = form.get("file");
    if (
      !validUuid(productId) ||
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      file.size === 0 ||
      file.size > 2 * 1024 * 1024
    )
      return { error: "PDF requis, de 2 Mo maximum." };
    const product = await client
      .from("products")
      .select(existingProductColumns)
      .eq("id", productId)
      .single();
    if (
      product.error ||
      normalizeProductType(product.data?.product_type || "") !== "digital"
    )
      return { error: "Produit numérique inaccessible." };
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== "%PDF-")
      return { error: "Signature PDF invalide." };
    const object_path = `${userId}/${productId}/${crypto.randomUUID()}.pdf`;
    const upload = await client.storage
      .from("digital-quarantine")
      .upload(object_path, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upload.error) return { error: "Téléversement privé refusé." };
    const record = await client.from("digital_assets").insert({
      product_id: productId,
      bucket: "digital-quarantine",
      object_path,
      original_name: file.name.slice(0, 200),
      size_bytes: file.size,
      mime_type: "application/pdf",
      status: "quarantine",
    });
    if (record.error)
      return {
        error:
          "Fichier privé en quarantaine ; métadonnées non enregistrées. À réconcilier dans Storage.",
      };
    revalidatePath("/admin/digital");
    return {
      success:
        "PDF conservé en quarantaine privée. Il n’est ni publié ni téléchargeable par les clients. Une analyse de sécurité reste nécessaire.",
    };
  } catch {
    return { error: "Téléversement numérique non autorisé ou indisponible." };
  }
}
