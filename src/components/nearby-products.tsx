"use client";
import Link from "next/link";
import { products, filterProducts } from "@/lib/catalog";
import { communeName } from "@/lib/geography";
import { useLocation } from "./location-provider";
import { LocationPicker } from "./location-picker";
import { ProductCard } from "./product-card";
export function NearbyProducts() {
  const { location } = useLocation();
  const result = filterProducts(
    { near: "1" },
    products.filter((p) => p.type === "stock"),
    location,
  );
  return (
    <section className="nearby-section shell">
      <div className="nearby-intro">
        <span className="eyebrow">LE COMMERCE, PLUS PROCHE DE VOUS</span>
        <h2>
          {location
            ? `À découvrir à ${communeName(location.communeId)}`
            : "Votre commune. Vos découvertes."}
        </h2>
        <p>
          Hinche, Cap-Haïtien, Port-au-Prince… Explorez notre simulation de
          stocks répartis en Haïti.
        </p>
        <LocationPicker compact />
        <Link href="/boutique?near=1" className="text-link">
          Voir les disponibilités →
        </Link>
        <small>Stocks de démonstration · Livraison et tarif à confirmer</small>
      </div>
      <div className="nearby-product-list">
        {result.items.length ? (
          result.items
            .slice(0, 3)
            .map((p) => <ProductCard product={p} key={p.id} />)
        ) : (
          <div className="empty">
            <h3>Aucun stock démo dans cette commune.</h3>
            <p>
              Explorez les autres villes. La présence de stock n’implique pas
              une desserte confirmée.
            </p>
            <Link className="button" href="/boutique">
              Voir toute Haïti
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
