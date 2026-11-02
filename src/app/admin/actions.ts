"use server";
import { validatePrivateFile } from "@/lib/admin/digital";
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
import { productRevision } from "@/lib/admin/products";
import { normalizeProductType } from "@/lib/product-adapter";
export type ActionState = {
  error?: string;
  success?: string;
  productId?: string;
};
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
    let current: import("@/lib/supabase/config").ExistingProduct | undefined;
    if (id) {
      const found = await client
        .from("products")
        .select(existingProductColumns)
        .eq("id", id)
        .single();
      if (found.error || !found.data) return { error: "Produit inaccessible." };
      current = found.data;
      if (String(form.get("revision") || "") !== productRevision(current!))
        return {
          error:
            "Ce produit a été modifié depuis son ouverture. Rechargez la page avant de réessayer.",
        };
    }
    const values = validateProductForm(
      form,
      current?.product_type ?? undefined,
    );
    if (
      current &&
      current.active !== values.active &&
      form.get("confirm_visibility") !== "on"
    )
      return { error: "Confirmez explicitement le changement de publication." };
    if (current) {
      let query = client.from("products").update(values).eq("id", id);
      query =
        current.name === null
          ? query.is("name", null)
          : query.eq("name", current.name);
      query =
        current.price_htg === null
          ? query.is("price_htg", null)
          : query.eq("price_htg", current.price_htg);
      query =
        current.product_type === null
          ? query.is("product_type", null)
          : query.eq("product_type", current.product_type);
      query =
        current.active === null
          ? query.is("active", null)
          : query.eq("active", current.active);
      query =
        current.stock === null
          ? query.is("stock", null)
          : query.eq("stock", current.stock);
      query =
        current.description === null
          ? query.is("description", null)
          : query.eq("description", current.description);
      query =
        current.image_url === null
          ? query.is("image_url", null)
          : query.eq("image_url", current.image_url);
      const saved = await query.select("id").maybeSingle();
      if (saved.error)
        return {
          error:
            "Enregistrement refusé. Vérifiez les autorisations et contraintes.",
        };
      if (!saved.data)
        return {
          error:
            "Un autre administrateur a modifié ce produit. Rechargez la page ; rien n’a été écrasé.",
        };
    } else {
      const requestId = String(form.get("request_id") || "");
      if (!validUuid(requestId))
        return { error: "Le formulaire a expiré. Rechargez la page." };
      const saved = await client
        .from("products")
        .insert({
          id: requestId,
          created_at: new Date().toISOString(),
          ...values,
        })
        .select("id")
        .single();
      if (saved.error) {
        if (saved.error.code === "23505") {
          const previous = await client
            .from("products")
            .select(existingProductColumns)
            .eq("id", requestId)
            .single();
          if (
            !previous.error &&
            previous.data &&
            previous.data.name === values.name &&
            Number(previous.data.price_htg) === values.price_htg &&
            previous.data.stock === values.stock &&
            previous.data.active === values.active &&
            previous.data.product_type === values.product_type &&
            previous.data.description === values.description
          )
            return {
              success:
                "Ce produit a déjà été enregistré. Aucun doublon n’a été créé.",
              productId: requestId,
            };
        }
        return {
          error:
            "Création refusée. Vérifiez les contraintes et types de la table existante.",
        };
      }
      revalidatePath("/", "layout");
      return { success: "Produit créé dans Supabase.", productId: requestId };
    }
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
    const { client, userId, capabilities } = await requireAdmin("images");
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
    const path = `${capabilities?.mediaManage ? "managed/" : ""}${userId}/${id}/${crypto.randomUUID()}.webp`;
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
    if (capabilities?.mediaManage) {
      const registered = await client.rpc("shena_register_product_image", {
        p_product_id: id,
        p_object_path: path,
        p_public_url: image_url,
        p_size: image.length,
      });
      if (registered.error)
        return {
          error:
            "Image téléversée, mais association non confirmée. Aucun ancien fichier n’a été supprimé. Vérifiez les médias avant de réessayer.",
        };
    } else {
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
    }
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
    const { client, userId, capabilities } = await requireAdmin("digital");
    const productId = String(form.get("id") || "");
    const file = form.get("file");
    if (
      !validUuid(productId) ||
      !(file instanceof File) ||
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
    const format = validatePrivateFile(
      file,
      bytes,
      capabilities?.extendedDigitalUploads === true,
    );
    if (!format)
      return {
        error:
          "Format ou signature refusés. Le fichier reste limité aux formats de quarantaine autorisés.",
      };
    const object_path = `${userId}/${productId}/${crypto.randomUUID()}.${format.extension}`;
    const upload = await client.storage
      .from("digital-quarantine")
      .upload(object_path, bytes, {
        contentType: format.mime,
        upsert: false,
      });
    if (upload.error) return { error: "Téléversement privé refusé." };
    const record = await client.from("digital_assets").insert({
      product_id: productId,
      bucket: "digital-quarantine",
      object_path,
      original_name: file.name.slice(0, 200),
      size_bytes: file.size,
      mime_type: format.mime,
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
        "Fichier conservé en quarantaine privée. Il n’est ni publié ni téléchargeable par les clients. Une analyse de sécurité reste nécessaire.",
    };
  } catch {
    return { error: "Téléversement numérique non autorisé ou indisponible." };
  }
}

export async function setPublicationAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireAdmin("products");
    const id = String(form.get("id") || "");
    if (!validUuid(id)) return { error: "Produit invalide." };
    const found = await client
      .from("products")
      .select(existingProductColumns)
      .eq("id", id)
      .single();
    if (found.error || !found.data) return { error: "Produit inaccessible." };
    const current = found.data;
    if (
      String(form.get("confirmation_name") || "").trim() !== current.name ||
      String(form.get("revision") || "") !== productRevision(current)
    )
      return {
        error:
          "Confirmez le nom exact du produit et rechargez la page s’il a changé.",
      };
    const active = form.get("target_active") === "true";
    if (active === current.active)
      return { success: "La publication est déjà dans cet état." };
    const result = await client
      .from("products")
      .update({ active })
      .eq("id", id)
      .eq("active", current.active)
      .eq("name", current.name)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      return {
        error:
          "La publication n’a pas été modifiée. Vérifiez les permissions ou rechargez la page.",
      };
    revalidatePath("/", "layout");
    return {
      success: active
        ? "Produit publié."
        : "Produit dépublié du catalogue. Le produit et ses dépendances sont conservés.",
    };
  } catch {
    return { error: "Modification de publication non autorisée." };
  }
}
