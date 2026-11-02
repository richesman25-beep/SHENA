"use server";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { validatePrivateFile } from "@/lib/admin/digital";
export type ReleaseActionState = {
  error?: string;
  success?: string;
  url?: string;
};
async function releaseContext() {
  const context = await requireAdmin("digital");
  await requireAdmin("products");
  const schema = await context.client.rpc("shena_digital_delivery_features");
  if (schema.error || schema.data?.version !== 1)
    throw new Error(
      "La préparation des fichiers n’est pas installée et validée.",
    );
  return context;
}
export async function prepareDigitalReleaseAction(
  _previous: ReleaseActionState,
  form: FormData,
): Promise<ReleaseActionState> {
  try {
    const { client, userId } = await releaseContext();
    const id = String(form.get("asset_id") || "");
    const sha = String(form.get("sha256") || "").toLowerCase();
    const report = String(form.get("security_report") || "").trim();
    if (
      !validUuid(id) ||
      !/^[a-f0-9]{64}$/.test(sha) ||
      report.length < 10 ||
      report.length > 2000 ||
      form.get("confirmed") !== "on"
    )
      return {
        error:
          "Indiquez le fichier, son SHA256 et la preuve de contrôle de sécurité.",
      };
    const asset = await client
      .from("digital_assets")
      .select("product_id,bucket,object_path,original_name,size_bytes")
      .eq("id", id)
      .eq("status", "quarantine")
      .maybeSingle();
    if (
      asset.error ||
      !asset.data ||
      asset.data.bucket !== "digital-quarantine" ||
      asset.data.size_bytes > 2097152
    )
      return { error: "Fichier de quarantaine inaccessible." };
    const file = await client.storage
      .from("digital-quarantine")
      .download(asset.data.object_path);
    if (
      file.error ||
      !file.data ||
      file.data.size > 2097152 ||
      file.data.size !== Number(asset.data.size_bytes)
    )
      return { error: "Le fichier privé ne peut pas être vérifié." };
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    if (
      !validatePrivateFile(
        {
          name: asset.data.original_name,
          type: file.data.type,
          size: bytes.length,
        },
        bytes,
        false,
      ) ||
      createHash("sha256").update(bytes).digest("hex") !== sha
    )
      return {
        error: "Le PDF et son SHA256 ne correspondent pas au contrôle déclaré.",
      };
    const destination = `${userId}/${asset.data.product_id}/${randomUUID()}.pdf`;
    const copied = await client.storage
      .from("digital-quarantine")
      .copy(asset.data.object_path, destination, {
        destinationBucket: "digital-products",
      });
    if (copied.error)
      return {
        error: "La copie privée est refusée. Aucun lien client n’a été créé.",
      };
    const registered = await client.rpc("shena_register_digital_release", {
      p_product_id: asset.data.product_id,
      p_object_path: destination,
      p_display_name: asset.data.original_name.replace(/[\\/\r\n]/g, "_"),
      p_sha256: sha,
      p_security_report: report,
    });
    if (registered.error)
      return {
        error:
          "La version n’a pas été enregistrée. La copie reste privée et inaccessible aux clients.",
      };
    revalidatePath("/admin/digital/releases");
    return {
      success:
        "Version privée préparée. Un second administrateur doit la contrôler ; aucun téléchargement client n’est activé.",
    };
  } catch {
    return { error: "Préparation refusée ou service indisponible." };
  }
}
export async function reviewDigitalReleaseAction(
  _previous: ReleaseActionState,
  form: FormData,
): Promise<ReleaseActionState> {
  try {
    const { client } = await releaseContext();
    const id = String(form.get("release_id") || ""),
      decision = String(form.get("decision") || ""),
      note = String(form.get("note") || "").trim();
    if (
      !validUuid(id) ||
      !["approved", "revoked"].includes(decision) ||
      note.length < 10 ||
      note.length > 1000 ||
      form.get("confirmed") !== "on"
    )
      return { error: "Confirmez une décision avec un compte rendu précis." };
    const result = await client.rpc("shena_review_digital_release", {
      p_id: id,
      p_decision: decision,
      p_note: note,
    });
    if (result.error)
      return {
        error:
          "Décision refusée. L’approbation exige un second administrateur distinct et autorisé.",
      };
    revalidatePath("/admin/digital/releases");
    return {
      success:
        decision === "approved"
          ? "Version approuvée. Les droits de paiement et de livraison restent obligatoires."
          : "Version révoquée. Les liens déjà émis expirent sous une minute.",
    };
  } catch {
    return { error: "Décision non autorisée." };
  }
}
export async function inspectDigitalReleaseAction(
  _previous: ReleaseActionState,
  form: FormData,
): Promise<ReleaseActionState> {
  try {
    const { client } = await releaseContext();
    const id = String(form.get("release_id") || "");
    if (!validUuid(id)) return { error: "Version invalide." };
    const r = await client
      .from("digital_releases")
      .select("bucket,object_path")
      .eq("id", id)
      .maybeSingle();
    if (r.error || !r.data || r.data.bucket !== "digital-products")
      return { error: "Version privée inaccessible." };
    const signed = await client.storage
      .from("digital-products")
      .createSignedUrl(r.data.object_path, 60, { download: true });
    return signed.error
      ? { error: "Lecture privée refusée." }
      : {
          url: signed.data.signedUrl,
          success:
            "Lien de contrôle administrateur valable une minute. Fichier à analyser dans un environnement sûr.",
        };
  } catch {
    return { error: "Contrôle non autorisé." };
  }
}
