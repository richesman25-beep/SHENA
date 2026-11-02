"use client";
import { useState } from "react";
import { type Product } from "@/lib/catalog";
import { useCart } from "./cart-provider";
import Link from "next/link";
export function Purchase({ product }: { product: Product }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const limit =
    product.type === "unknown"
      ? 0
      : product.type === "digital"
        ? 1
        : product.type === "stock"
          ? product.stock
          : 10;
  return (
    <div className="purchase">
      <label>
        Quantité
        <input
          type="number"
          min="1"
          max={limit}
          value={quantity}
          onChange={(e) =>
            setQuantity(
              Math.min(
                limit,
                Math.max(1, Math.floor(Number(e.target.value) || 1)),
              ),
            )
          }
        />
      </label>
      <button
        className="button"
        disabled={limit === 0}
        onClick={() => {
          add(product.id, quantity);
          setAdded(true);
        }}
      >
        {product.source === "supabase"
          ? "Ajouter au panier local"
          : "Ajouter au panier démo"}
      </button>
      {added && (
        <p role="status">
          Article ajouté.{" "}
          <Link className="text-link" href="/panier">
            Voir mon panier →
          </Link>
        </p>
      )}
      <small>
        {product.source === "supabase"
          ? "Le panier ne réserve aucun stock. Prix à revérifier côté serveur avant toute future commande."
          : "Prix indicatifs. Aucune commande ni aucun paiement ne sera effectué."}
      </small>
    </div>
  );
}
