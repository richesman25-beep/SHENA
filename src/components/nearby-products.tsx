"use client";
import Link from "next/link";
import { filterProducts } from "@/lib/catalog";
import { communeName } from "@/lib/geography";
import { useCatalog } from "./catalog-provider";
import { useLocation } from "./location-provider";
import { LocationPicker } from "./location-picker";
import { ProductCard } from "./product-card";
export function NearbyProducts() {
  const { products, mode } = useCatalog();
  const { location } = useLocation();
  if (mode !== "demo")
    return (
      <section className="nearby-section shell">
        <div className="nearby-intro">
          <span className="eyebrow">DISPONIBILITÉS GÉOGRAPHIQUES</span>
          <h2>Votre commune, bientôt dans le catalogue.</h2>
          <p>
            Les stocks par emplacement ne sont pas encore connectés. Aucun stock
            fictif ne vous est présenté comme disponible près de vous.
          </p>
          <LocationPicker compact />
        </div>
        <div className="empty">
          <h3>Emplacements en préparation</h3>
          <p>
            Le catalogue connecté affiche uniquement le stock global enregistré.
            Livraison et tarif à confirmer.
          </p>
          <Link className="button" href="/boutique">
            Explorer les produits actifs
          </Link>
        </div>
      </section>
    );
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
