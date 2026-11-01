"use client";
import { CartShippingPreview } from "./cart-shipping-preview";
import { ProductVisual } from "./product-visual";
import Link from "next/link";
import { CatalogStatus } from "./catalog-status";
import { useCatalog } from "./catalog-provider";
import { useCart } from "./cart-provider";
import { money, typeLabel } from "@/lib/catalog";
import { cartTotal } from "@/lib/cart";
export function CartView() {
  const { products, mode, status } = useCatalog();
  const { lines, ready, update } = useCart();
  if (status !== "ready") return <CatalogStatus />;
  if (!ready) return <p role="status">Chargement du panier…</p>;
  if (!lines.length)
    return (
      <div className="empty">
        <span className="eyebrow">TOUT COMMENCE PAR UNE ENVIE</span>
        <h2>Votre panier attend vos découvertes.</h2>
        <p>Explorez les univers SHENA et ajoutez un premier article.</p>
        <Link href="/boutique" className="button">
          Découvrir la boutique →
        </Link>
      </div>
    );
  const hasPhysical = lines.some(
    (l) => products.find((p) => p.id === l.id)?.type !== "digital",
  );
  return (
    <div className="cart-layout">
      <div>
        {lines.map((line) => {
          const p = products.find((p) => p.id === line.id)!;
          const max =
            p.type === "digital" ? 1 : p.type === "stock" ? p.stock : 10;
          return (
            <article className="cart-line" key={line.id}>
              <Link href={`/produit/${p.slug}`}>
                <ProductVisual
                  image={p.image}
                  name={p.name}
                  url={p.imageUrl}
                  live={p.source === "supabase"}
                />
              </Link>
              <div>
                <span className="eyebrow">{typeLabel(p.type)}</span>
                <h2>
                  <Link href={`/produit/${p.slug}`}>{p.name}</Link>
                </h2>
                <p>{money(p.price)}</p>
                <label className="quantity">
                  Quantité pour {p.name}
                  <input
                    aria-label={`Quantité pour ${p.name}`}
                    type="number"
                    value={line.quantity}
                    min="1"
                    max={max}
                    onChange={(e) =>
                      update(
                        p.id,
                        Math.min(
                          max,
                          Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        ),
                      )
                    }
                  />
                </label>
                <button className="remove" onClick={() => update(p.id, 0)}>
                  Retirer {p.name}
                </button>
              </div>
              <strong>{money(p.price * line.quantity)}</strong>
            </article>
          );
        })}
      </div>
      <aside className="cart-summary">
        <h2>Votre récapitulatif</h2>
        {mode === "demo" && <CartShippingPreview lines={lines} />}
        <dl>
          <div>
            <dt>Sous-total indicatif</dt>
            <dd>{money(cartTotal(lines, products))}</dd>
          </div>
          <div>
            <dt>Livraison physique</dt>
            <dd>{hasPhysical ? "À définir" : "Non applicable"}</dd>
          </div>
        </dl>
        <p className="info-box">
          Les produits numériques ne génèrent aucun frais de livraison physique.
        </p>
        <p>
          Ce panier est conservé sur cet appareil. Les prix et stocks seront
          revérifiés côté serveur lors du futur parcours de commande.
        </p>
        <button className="button" disabled>
          Commandes bientôt disponibles
        </button>
        <small>Pas de paiement, pas de réservation de stock.</small>
        <Link className="text-link" href="/boutique">
          Continuer mes découvertes →
        </Link>
      </aside>
    </div>
  );
}
