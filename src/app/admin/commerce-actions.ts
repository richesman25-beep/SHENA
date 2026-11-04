"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { validUuid } from "@/lib/admin/policy";
import { commerceContext } from "@/lib/commerce/server";
import { priceMinor, CheckoutError } from "@/lib/commerce/quote";
import { departments, communes } from "@/lib/geography";
import type { ActionState } from "./actions";
async function adminCommerce(
  feature: "delivery" | "orders" | "manualPayments",
) {
  const admin = await requireAdmin();
  const context = await commerceContext();
  if (!context?.capabilities[feature])
    throw new CheckoutError(
      "Cette opération n’est pas activée sur cet environnement validé.",
    );
  const verified = await context.client.auth.getUser();
  if (verified.error || verified.data.user?.id !== admin.userId)
    throw new CheckoutError(
      "Session administrateur incohérente. Reconnectez-vous.",
    );
  return { client: context.client, userId: admin.userId };
}
export async function saveDeliveryZoneAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await adminCommerce("delivery");
    const id = String(form.get("id") || "");
    const name = String(form.get("name") || "").trim();
    const department = String(form.get("department_id") || "");
    const commune = String(form.get("commune_id") || "");
    if (
      (id && !validUuid(id)) ||
      name.length < 2 ||
      name.length > 100 ||
      !departments.some((d) => d.id === department) ||
      (commune &&
        !communes.some(
          (c) => c.id === commune && c.departmentId === department,
        ))
    )
      throw new CheckoutError("Vérifiez le nom et la destination de la zone.");
    const fee = priceMinor(String(form.get("fee_htg") || ""));
    const active = form.get("active") === "on";
    if (active && form.get("confirmed") !== "on")
      throw new CheckoutError("Confirmez explicitement le tarif actif.");
    const result = await client.rpc("shena_save_delivery_zone", {
      p_id: id || crypto.randomUUID(),
      p_name: name,
      p_department_id: department,
      p_commune_id: commune || null,
      p_fee_minor: fee,
      p_active: active,
    });
    if (result.error)
      return {
        error:
          "La zone n’a pas été enregistrée. Vérifiez les doublons et les autorisations.",
      };
    revalidatePath("/admin/livraisons");
    revalidatePath("/commander");
    return {
      success:
        "Zone enregistrée. Les commandes existantes conservent leur tarif initial.",
    };
  } catch (error) {
    return {
      error:
        error instanceof CheckoutError
          ? error.message
          : "Modification de livraison non autorisée.",
    };
  }
}
export async function transitionOrderAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await adminCommerce("orders");
    const id = String(form.get("order_id") || "");
    const status = String(form.get("status") || "");
    const version = Number(form.get("version"));
    const note = String(form.get("note") || "").trim();
    if (
      !validUuid(id) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !["processing", "shipped", "delivered", "cancelled"].includes(status) ||
      note.length < 5 ||
      note.length > 1000 ||
      form.get("confirmed") !== "on"
    )
      throw new CheckoutError(
        "Confirmez un statut autorisé et une justification (5 à 1 000 caractères).",
      );
    const result = await client.rpc("shena_transition_order", {
      p_order_id: id,
      p_status: status,
      p_expected_version: version,
      p_note: note,
    });
    if (result.error)
      return {
        error:
          "Transition refusée. Vérifiez le paiement, le statut actuel et les modifications concurrentes.",
      };
    revalidatePath("/admin/commandes");
    revalidatePath(`/admin/commandes/${id}`);
    revalidatePath(`/compte/commandes/${id}`);
    return { success: "Statut mis à jour et opération journalisée." };
  } catch (error) {
    return {
      error:
        error instanceof CheckoutError
          ? error.message
          : "Mise à jour de commande non autorisée.",
    };
  }
}
export async function submitPaymentReviewAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await adminCommerce("manualPayments");
    const id = String(form.get("order_id") || "");
    const provider = String(form.get("provider") || "");
    const reference = String(form.get("reference") || "").trim();
    const note = String(form.get("note") || "").trim();
    const amount = priceMinor(String(form.get("amount_htg") || ""));
    const key = String(form.get("idempotency_key") || "");
    if (
      !validUuid(id) ||
      !validUuid(key) ||
      !["moncash", "natcash"].includes(provider) ||
      reference.length < 4 ||
      reference.length > 160 ||
      note.length < 10 ||
      note.length > 1000 ||
      form.get("statement_verified") !== "on"
    )
      throw new CheckoutError(
        "Vérifiez la référence, le montant et la réception effective sur le compte de la boutique.",
      );
    const result = await client.rpc("shena_submit_payment_review", {
      p_order_id: id,
      p_provider: provider,
      p_external_reference: reference,
      p_amount_minor: amount,
      p_note: note,
      p_idempotency_key: key,
    });
    if (result.error)
      return {
        error:
          "Vérification non enregistrée : référence déjà utilisée, montant différent ou opération non autorisée.",
      };
    revalidatePath(`/admin/commandes/${id}`);
    return {
      success:
        "Vérification enregistrée. Un second administrateur distinct doit contrôler et approuver. La commande n’est pas encore payée.",
    };
  } catch (error) {
    return {
      error:
        error instanceof CheckoutError
          ? error.message
          : "Vérification de paiement non autorisée.",
    };
  }
}
export async function decidePaymentReviewAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { client } = await adminCommerce("manualPayments");
    const reviewId = String(form.get("review_id") || "");
    const orderId = String(form.get("order_id") || "");
    const decision = String(form.get("decision") || "");
    const note = String(form.get("note") || "").trim();
    if (
      !validUuid(reviewId) ||
      !validUuid(orderId) ||
      !["approved", "rejected"].includes(decision) ||
      note.length < 10 ||
      note.length > 1000 ||
      form.get("statement_verified") !== "on"
    )
      throw new CheckoutError(
        "Confirmez votre contrôle indépendant et une justification précise.",
      );
    const result = await client.rpc("shena_decide_payment_review", {
      p_review_id: reviewId,
      p_decision: decision,
      p_note: note,
    });
    if (result.error)
      return {
        error:
          "Décision refusée : compte distinct requis, état déjà traité ou contrôle du montant non satisfait.",
      };
    revalidatePath("/admin/commandes");
    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath(`/compte/commandes/${orderId}`);
    return {
      success:
        decision === "approved"
          ? "Paiement contrôlé par deux administrateurs et décision journalisée. Aucun téléchargement n’est délivré automatiquement."
          : "Vérification rejetée. Aucun paiement n’est confirmé.",
    };
  } catch (error) {
    return {
      error:
        error instanceof CheckoutError
          ? error.message
          : "Décision de paiement non autorisée.",
    };
  }
}
