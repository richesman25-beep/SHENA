import type { ExistingProduct } from "../supabase/config";
import { normalizeProductType } from "../product-adapter";
import { validUuid } from "../admin/policy";
import { normalizeLocation, type CustomerLocation } from "../geography";
export class CheckoutError extends Error {}
export type CheckoutLine = { id: string; quantity: number };
export type QuoteRequest = {
  lines: CheckoutLine[];
  location: CustomerLocation | null;
  zoneId: string | null;
};
export type DeliveryZone = {
  id: string;
  name: string;
  department_id: string;
  commune_id: string | null;
  fee_minor: number;
  active: boolean;
};
export type ServerQuote = {
  currency: "HTG";
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
    type: "stock" | "digital";
  }[];
  subtotalMinor: number;
  deliveryMinor: number | null;
  totalMinor: number | null;
  zoneId: string | null;
  requiresDelivery: boolean;
  canOrder: boolean;
  message?: string;
};
export function priceMinor(raw: unknown) {
  if (
    (typeof raw !== "number" && typeof raw !== "string") ||
    !/^\d+(\.\d{1,2})?$/.test(String(raw))
  )
    throw new CheckoutError(
      "Le prix d’un produit doit être vérifié par la boutique.",
    );
  const [whole, cents = ""] = String(raw).split(".");
  const amount = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 10_000_000_000)
    throw new CheckoutError("Prix hors limites.");
  return amount;
}
export function parseQuoteRequest(raw: unknown): QuoteRequest {
  if (!raw || typeof raw !== "object")
    throw new CheckoutError("Panier invalide.");
  const v = raw as Record<string, unknown>;
  if (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > 50)
    throw new CheckoutError("Le panier doit contenir entre 1 et 50 produits.");
  const ids = new Set<string>();
  const lines = v.lines.map((value: unknown) => {
    if (!value || typeof value !== "object")
      throw new CheckoutError("Ligne de panier invalide.");
    const l = value as Record<string, unknown>;
    if (
      typeof l.id !== "string" ||
      !validUuid(l.id) ||
      ids.has(l.id.toLowerCase()) ||
      typeof l.quantity !== "number" ||
      !Number.isSafeInteger(l.quantity) ||
      l.quantity < 1 ||
      l.quantity > 100
    )
      throw new CheckoutError(
        "Vérifiez les produits et leurs quantités (1 à 100, sans doublon).",
      );
    ids.add(l.id.toLowerCase());
    return { id: l.id.toLowerCase(), quantity: l.quantity };
  });
  const location = v.location == null ? null : normalizeLocation(v.location);
  if (v.location != null && !location)
    throw new CheckoutError(
      "Sélectionnez un département et une commune pris en charge.",
    );
  const zoneId =
    v.zoneId == null || v.zoneId === ""
      ? null
      : typeof v.zoneId === "string" && validUuid(v.zoneId)
        ? v.zoneId
        : null;
  if (v.zoneId && !zoneId)
    throw new CheckoutError("Zone de livraison invalide.");
  // Aucune valeur price/total/paid venant du navigateur n'est conservée.
  return { lines, location, zoneId };
}
export function calculateServerQuote(
  request: QuoteRequest,
  products: ExistingProduct[],
  zones: DeliveryZone[],
  orderingEnabled: boolean,
): ServerQuote {
  const items = request.lines.map((line) => {
    const p = products.find((p) => p.id === line.id && p.active === true);
    if (!p || typeof p.name !== "string" || !p.name.trim())
      throw new CheckoutError(
        "Un produit a changé ou n’est plus disponible. Rechargez votre panier.",
      );
    const type = normalizeProductType(p.product_type);
    if (type !== "stock" && type !== "digital")
      throw new CheckoutError(
        "Les articles sur commande nécessitent une confirmation de la boutique.",
      );
    if (type === "digital" && line.quantity !== 1)
      throw new CheckoutError(
        "Une seule licence numérique par produit est autorisée.",
      );
    if (
      type === "stock" &&
      (p.stock === null ||
        !Number.isSafeInteger(p.stock) ||
        p.stock < line.quantity)
    )
      throw new CheckoutError(
        "Le stock d’un produit est insuffisant. Mettez à jour votre panier.",
      );
    const unitPriceMinor = priceMinor(p.price_htg);
    return {
      id: p.id,
      name: p.name,
      quantity: line.quantity,
      unitPriceMinor,
      totalMinor: unitPriceMinor * line.quantity,
      type,
    };
  });
  const subtotalMinor = items.reduce((sum, item) => sum + item.totalMinor, 0);
  if (!Number.isSafeInteger(subtotalMinor))
    throw new CheckoutError("Montant du panier hors limites.");
  const requiresDelivery = items.some((item) => item.type === "stock");
  let zone: DeliveryZone | undefined;
  if (requiresDelivery && request.location && request.zoneId) {
    zone = zones.find(
      (z) =>
        z.id === request.zoneId &&
        z.active &&
        z.department_id === request.location!.departmentId &&
        (!z.commune_id || z.commune_id === request.location!.communeId),
    );
    if (
      !zone ||
      !Number.isSafeInteger(zone.fee_minor) ||
      zone.fee_minor < 0 ||
      zone.fee_minor > 10_000_000_000
    )
      throw new CheckoutError(
        "Cette zone de livraison n’est plus disponible pour votre destination.",
      );
  }
  const deliveryMinor = requiresDelivery ? (zone?.fee_minor ?? null) : 0;
  return {
    currency: "HTG",
    items,
    subtotalMinor,
    deliveryMinor,
    totalMinor: deliveryMinor === null ? null : subtotalMinor + deliveryMinor,
    zoneId: zone?.id ?? null,
    requiresDelivery,
    canOrder: orderingEnabled && deliveryMinor !== null,
    ...(!orderingEnabled
      ? {
          message:
            "Les commandes sont désactivées. Ce calcul ne réserve aucun stock et ne déclenche aucun paiement.",
        }
      : deliveryMinor === null
        ? {
            message:
              "Choisissez une destination et une zone de livraison configurée par la boutique.",
          }
        : {}),
  };
}
export function validateContact(raw: unknown) {
  if (!raw || typeof raw !== "object")
    throw new CheckoutError("Coordonnées requises.");
  const v = raw as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof v[key] === "string" ? v[key].trim().slice(0, max + 1) : "";
  const name = text("name", 120),
    phone = text("phone", 32),
    address = text("address", 500),
    note = text("note", 1000);
  if (
    name.length < 2 ||
    name.length > 120 ||
    !/^[+\d()\s-]{7,32}$/.test(phone) ||
    address.length > 500 ||
    note.length > 1000
  )
    throw new CheckoutError(
      "Vérifiez le nom, le téléphone et la longueur de l’adresse ou des notes.",
    );
  return { name, phone, address, note };
}
