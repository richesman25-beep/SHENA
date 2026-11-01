import type { Product } from "./catalog";
import { communes, type CustomerLocation } from "./geography";
export type StockLocation = {
  id: string;
  name: string;
  communeId: string;
  public: boolean;
};
export type Inventory = {
  productId: string;
  locationId: string;
  quantity: number;
};
export type DeliveryRule = {
  id: string;
  originLocationId: string;
  destinationCommuneId: string;
  mode: "pickup" | "local" | "interdepartmental";
  feeHtg: number | null;
  estimatedLabel: string | null;
  enabled: boolean;
};
export const stockLocations: StockLocation[] = [
  {
    id: "hinche-demo",
    name: "Point SHENA Hinche — démo",
    communeId: "hinche",
    public: true,
  },
  {
    id: "cap-demo",
    name: "Point SHENA Cap-Haïtien — démo",
    communeId: "cap-haitien",
    public: true,
  },
  {
    id: "pap-demo",
    name: "Point SHENA Port-au-Prince — démo",
    communeId: "port-au-prince",
    public: true,
  },
  {
    id: "maissade-demo",
    name: "Point SHENA Maïssade — démo",
    communeId: "maissade",
    public: true,
  },
  {
    id: "cayes-demo",
    name: "Point SHENA Les Cayes — démo",
    communeId: "les-cayes",
    public: true,
  },
];
/** Répartition fictive dont les sommes correspondent aux stocks de démonstration existants. */
export const inventories: Inventory[] = [
  { productId: "sneakers-demo", locationId: "hinche-demo", quantity: 6 },
  { productId: "sneakers-demo", locationId: "cap-demo", quantity: 4 },
  { productId: "sneakers-demo", locationId: "pap-demo", quantity: 2 },
  { productId: "headphones-demo", locationId: "pap-demo", quantity: 5 },
  { productId: "headphones-demo", locationId: "cap-demo", quantity: 3 },
  { productId: "beauty-demo", locationId: "hinche-demo", quantity: 2 },
  { productId: "beauty-demo", locationId: "maissade-demo", quantity: 4 },
  { productId: "home-demo", locationId: "cayes-demo", quantity: 4 },
  { productId: "home-demo", locationId: "hinche-demo", quantity: 0 },
];
// Aucune zone, adresse, durée, desserte ou tarification réelle n'est inventée.
export const deliveryRules: DeliveryRule[] = [];
export function availableInventory(
  productId: string,
  rows: Inventory[] = inventories,
) {
  return rows.filter(
    (i) =>
      i.productId === productId &&
      i.quantity > 0 &&
      stockLocations.some((l) => l.id === i.locationId && l.public),
  );
}
export function geographicRank(
  product: Product,
  location: CustomerLocation | null,
  rows: Inventory[] = inventories,
): number {
  if (product.type === "digital") return 3;
  if (product.type === "preorder") return 4;
  const inventory = availableInventory(product.id, rows);
  if (!inventory.length) return 5;
  if (!location) return 2;
  const origins = inventory.map((i) =>
    stockLocations.find((l) => l.id === i.locationId)!,
  );
  if (origins.some((l) => l.communeId === location.communeId)) return 0;
  if (
    origins.some(
      (l) =>
        communes.find((c) => c.id === l.communeId)?.departmentId ===
        location.departmentId,
    )
  )
    return 1;
  return 2;
}
export function availabilityLabel(
  product: Product,
  location: CustomerLocation | null,
) {
  const rank = geographicRank(product, location);
  if (product.type === "digital") return "Numérique · Sans livraison physique";
  if (rank === 4) return "Sur commande · À confirmer";
  if (rank === 5) return "Rupture de stock (démo)";
  if (!location) return "Stock multiville de démonstration";
  return rank === 0
    ? "Disponible dans votre commune (démo)"
    : rank === 1
      ? "Disponible dans votre département (démo)"
      : "Stock dans une autre ville (démo)";
}
export function deliveryOptions(
  product: Product,
  location: CustomerLocation | null,
  rules: DeliveryRule[] = deliveryRules,
) {
  if (product.type === "digital")
    return {
      kind: "digital" as const,
      message:
        "Aucun frais de livraison physique. Accès après paiement vérifié : fonctionnalité à venir.",
      rules: [],
    };
  const origins = new Set(
    availableInventory(product.id).map((i) => i.locationId),
  );
  const matches = location
    ? rules.filter(
        (r) =>
          r.enabled &&
          origins.has(r.originLocationId) &&
          r.destinationCommuneId === location.communeId,
      )
    : [];
  return {
    kind: "physical" as const,
    message: matches.length
      ? "Options configurées de démonstration"
      : "Livraison et tarif à confirmer",
    rules: matches,
  };
}
/** Plan indicatif sans réservation ni garantie d'expédition. Une ligne peut être répartie entre plusieurs points. */
export function previewAllocations(
  lines: { id: string; quantity: number }[],
  location: CustomerLocation | null,
) {
  return lines.map((line) => {
    let remaining = line.quantity;
    const sorted = [...availableInventory(line.id)].sort((a, b) => {
      const score = (i: Inventory) => {
        const origin = stockLocations.find((l) => l.id === i.locationId)!;
        return origin.communeId === location?.communeId
          ? 0
          : communes.find((c) => c.id === origin.communeId)?.departmentId ===
              location?.departmentId
            ? 1
            : 2;
      };
      return score(a) - score(b);
    });
    const parcels = sorted.flatMap((i) => {
      const quantity = Math.min(remaining, i.quantity);
      remaining -= quantity;
      return quantity > 0 ? [{ locationId: i.locationId, quantity }] : [];
    });
    return { productId: line.id, parcels, unallocated: remaining };
  });
}
