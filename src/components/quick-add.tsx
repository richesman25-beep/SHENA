"use client";
import { useState } from "react";
import { useCatalog } from "./catalog-provider";
import { useCart } from "./cart-provider";
import { Icon } from "./icons";
export function QuickAdd({
  id,
  name,
  disabled = false,
}: {
  id: string;
  name: string;
  disabled?: boolean;
}) {
  const { mode } = useCatalog();
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      disabled={disabled}
      className={`quick-add ${added ? "added" : ""}`}
      aria-label={`Ajouter ${name} au panier ${mode === "demo" ? "démo" : "local"}`}
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
