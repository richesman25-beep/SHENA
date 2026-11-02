"use server";
import { commerceContext, quoteFromServer } from "@/lib/commerce/server";
import {
  CheckoutError,
  parseQuoteRequest,
  validateContact,
} from "@/lib/commerce/quote";
import { validUuid } from "@/lib/admin/policy";
export type OrderActionState = {
  error?: string;
  orderId?: string;
  orderNumber?: string;
};
export async function placeOrderAction(
  _previous: OrderActionState,
  form: FormData,
): Promise<OrderActionState> {
  try {
    if (form.get("confirmed") !== "on")
      return { error: "Confirmez les coordonnées et le récapitulatif." };
    const context = await commerceContext();
    if (!context?.capabilities.orders)
      return {
        error:
          "Les commandes sont désactivées. Aucun enregistrement ni paiement n’a été effectué.",
      };
    const verified = await context.client.auth.getUser();
    if (
      verified.error ||
      !verified.data.user ||
      !verified.data.user.email_confirmed_at
    )
      return {
        error:
          "Connectez-vous avec un compte client vérifié avant de commander.",
      };
    const body = String(form.get("basket") || "");
    if (body.length > 16000) throw new CheckoutError("Panier trop volumineux.");
    const request = parseQuoteRequest(JSON.parse(body));
    const contact = validateContact({
      name: form.get("name"),
      phone: form.get("phone"),
      address: form.get("address"),
      note: form.get("note"),
    });
    const key = String(form.get("idempotency_key") || "");
    const expected = Number(form.get("expected_total_minor"));
    if (!validUuid(key) || !Number.isSafeInteger(expected) || expected < 0)
      throw new CheckoutError(
        "Le récapitulatif a expiré. Recalculez votre panier.",
      );
    const quote = await quoteFromServer(request);
    if (!quote.canOrder || quote.totalMinor === null)
      throw new CheckoutError(
        quote.message || "La commande ne peut pas être préparée.",
      );
    if (quote.totalMinor !== expected)
      throw new CheckoutError(
        "Les prix ou frais ont changé. Recalculez le récapitulatif avant de confirmer.",
      );
    if (quote.requiresDelivery && contact.address.length < 8)
      throw new CheckoutError(
        "Indiquez une adresse de livraison suffisamment précise.",
      );
    // Le RPC recalcule encore les montants sous verrou et contrôle stock + idempotence.
    const result = await context.client.rpc("shena_place_order", {
      p_lines: request.lines,
      p_location: request.location,
      p_zone_id: quote.zoneId,
      p_contact: contact,
      p_idempotency_key: key,
      p_expected_total_minor: expected,
    });
    if (
      result.error ||
      !validUuid(result.data?.id || "") ||
      typeof result.data?.order_number !== "string"
    )
      return {
        error:
          "Commande non confirmée. Aucun paiement n’est déclaré. Réessayez avec le même formulaire pour éviter un doublon.",
      };
    return { orderId: result.data.id, orderNumber: result.data.order_number };
  } catch (error) {
    return {
      error:
        error instanceof CheckoutError
          ? error.message
          : "La commande n’a pas pu être confirmée. Aucun paiement n’a été validé.",
    };
  }
}
