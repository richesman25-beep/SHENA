"use client";
import { products } from "@/lib/catalog";
import { previewAllocations, stockLocations } from "@/lib/logistics";
import { communeName } from "@/lib/geography";
import { useLocation } from "./location-provider";
import type { CartLine } from "@/lib/cart";
export function CartShippingPreview({ lines }: { lines: CartLine[] }) {
  const { location } = useLocation();
  const physical = lines.filter(
    (l) => products.find((p) => p.id === l.id)?.type !== "digital",
  );
  if (!physical.length) return null;
  const allocations = previewAllocations(physical, location);
  return (
    <details className="shipping-preview">
      <summary>Origines possibles de votre panier (simulation)</summary>
      <p>
        Plusieurs villes peuvent impliquer plusieurs colis. Aucun stock n’est
        réservé. Frais, desserte et regroupement seront contrôlés côté serveur.
      </p>
      {allocations.map((a) => (
        <div key={a.productId}>
          <strong>{products.find((p) => p.id === a.productId)?.name}</strong>
          {a.parcels.map((parcel) => (
            <span key={parcel.locationId}>
              {communeName(
                stockLocations.find((l) => l.id === parcel.locationId)!
                  .communeId,
              )}{" "}
              · {parcel.quantity} unité(s) fictive(s)
            </span>
          ))}
          {a.unallocated > 0 && (
            <span>
              {a.unallocated} unité(s) sans point attribuable · disponibilité à
              confirmer
            </span>
          )}
        </div>
      ))}
      <p>Livraison et tarif à confirmer</p>
    </details>
  );
}
