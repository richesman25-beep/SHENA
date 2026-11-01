"use client";
import { useState } from "react";
import { useCart } from "./cart-provider";
import { Icon } from "./icons";
export function QuickAdd({ id, name }: { id: string; name: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      className={`quick-add ${added ? "added" : ""}`}
      aria-label={`Ajouter ${name} au panier démo`}
      onClick={() => {
        add(id);
        setAdded(true);
      }}
    >
      <Icon name={added ? "check" : "bag"} />
      <span>{added ? "Ajouté au panier" : "Ajouter au panier"}</span>
    </button>
  );
}
