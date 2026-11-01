"use client";
import { type Product } from "@/lib/catalog";
import {
  availabilityLabel,
  availableInventory,
  deliveryOptions,
  stockLocations,
  geographicRank,
} from "@/lib/logistics";
import { communeName } from "@/lib/geography";
import { useLocation } from "./location-provider";
import { LocationPicker } from "./location-picker";
export function ProductAvailability({
  product,
  detail = false,
}: {
  product: Product;
  detail?: boolean;
}) {
  const { location } = useLocation();
  const rank = geographicRank(product, location);
  const label = availabilityLabel(product, location);
  if (!detail)
    return (
      <div className="card-geography">
        <span className={`geo-label rank-${rank}`}>{label}</span>
        {product.type === "stock" && (
          <small>
            {availableInventory(product.id)
              .map((i) =>
                communeName(
                  stockLocations.find((l) => l.id === i.locationId)!.communeId,
                ),
              )
              .join(" · ")}
          </small>
        )}
        {product.type === "preorder" && (
          <small>Origine et disponibilité à confirmer</small>
        )}
      </div>
    );
  const options = deliveryOptions(product, location);
  return (
    <section className="availability-panel">
      <h2>
        {product.type === "digital"
          ? "Votre accès numérique"
          : "Disponibilité et livraison"}
      </h2>
      <p className={`geo-label rank-${rank}`}>{label}</p>
      {product.type !== "digital" && (
        <>
          <LocationPicker compact />
          <div className="inventory-list">
            {availableInventory(product.id).map((i) => {
              const origin = stockLocations.find((l) => l.id === i.locationId)!;
              return (
                <div key={i.locationId}>
                  <span>{communeName(origin.communeId)}</span>
                  <strong>{i.quantity} unités fictives</strong>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="delivery-pending">{options.message}</p>
      {product.type !== "digital" && (
        <div className="delivery-mode-list">
          <span>Retrait</span>
          <span>Livraison locale</span>
          <span>Interdépartementale</span>
          <small>
            Modes envisagés, aucune règle de desserte ni adresse de retrait
            confirmée.
          </small>
        </div>
      )}
    </section>
  );
}
