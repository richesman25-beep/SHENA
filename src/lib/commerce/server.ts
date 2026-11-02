import "server-only";
import { publicClient } from "../supabase/public";
import { sessionClient } from "../supabase/server";
import {
  getSupabaseConfig,
  existingProductColumns,
  type ExistingProduct,
} from "../supabase/config";
import { isApprovedCommerce } from "../supabase/deployment";
import {
  calculateServerQuote,
  CheckoutError,
  parseQuoteRequest,
  type DeliveryZone,
} from "./quote";
export type CommerceCapabilities = {
  delivery: boolean;
  orders: boolean;
  manualPayments: boolean;
};
export async function commerceContext() {
  try {
    const config = getSupabaseConfig();
    if (!config || !isApprovedCommerce(config.url, process.env)) return null;
    const client = await sessionClient();
    if (!client) return null;
    const result = await client.rpc("shena_checkout_features");
    if (result.error || result.data?.version !== 1) return null;
    const capabilities: CommerceCapabilities = {
      delivery: result.data.delivery === true,
      orders: result.data.orders === true,
      manualPayments: result.data.manualPayments === true,
    };
    return { client, capabilities };
  } catch {
    return null;
  }
}

export async function publicDeliveryZones() {
  const context = await commerceContext();
  if (!context?.capabilities.delivery) return [];
  const result = await context.client
    .from("commerce_delivery_zones")
    .select("id,name,department_id,commune_id,fee_minor,active")
    .eq("active", true)
    .order("name");
  if (result.error)
    throw new CheckoutError(
      "Les zones de livraison ne peuvent pas être chargées.",
    );
  return (result.data || []) as DeliveryZone[];
}
export async function quoteFromServer(raw: unknown) {
  if (process.env.SHENA_CATALOG_MODE === "demo")
    throw new CheckoutError(
      "Le catalogue de démonstration ne permet pas de préparer une commande réelle.",
    );
  const request = parseQuoteRequest(raw);
  const client = publicClient();
  if (!client)
    throw new CheckoutError("La boutique n’est pas encore configurée.");
  const result = await client
    .from("products")
    .select(existingProductColumns)
    .eq("active", true)
    .in(
      "id",
      request.lines.map((l) => l.id),
    );
  if (result.error)
    throw new CheckoutError(
      "Les prix et stocks ne peuvent pas être vérifiés. Réessayez plus tard.",
    );
  const context = await commerceContext();
  const zones = request.zoneId ? await publicDeliveryZones() : [];
  return calculateServerQuote(
    request,
    (result.data || []) as ExistingProduct[],
    zones,
    context?.capabilities.orders === true,
  );
}

export async function adminCommerceMetrics() {
  const { adminView } = await import("../admin/auth");
  if (!(await adminView())) return null;
  const context = await commerceContext();
  if (!context?.capabilities.orders) return null;
  const result = await context.client.rpc("shena_admin_commerce_metrics");
  if (
    result.error ||
    !["orderCount", "pendingCount", "verifiedRevenueMinor"].every(
      (k) => Number.isSafeInteger(result.data?.[k]) && result.data[k] >= 0,
    )
  )
    return {
      error: "Les statistiques de commande ne peuvent pas être vérifiées.",
    };
  return {
    orderCount: result.data.orderCount as number,
    pendingCount: result.data.pendingCount as number,
    verifiedRevenueMinor: result.data.verifiedRevenueMinor as number,
  };
}
