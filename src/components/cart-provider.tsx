"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { normalizeCart, type CartLine } from "@/lib/cart";
const key = "shena.cart.v1";
const subscribe = () => () => {};
const Context = createContext<{
  lines: CartLine[];
  ready: boolean;
  add: (id: string, quantity?: number) => void;
  update: (id: string, quantity: number) => void;
  notice: string;
}>({ lines: [], ready: false, add: () => {}, update: () => {}, notice: "" });
export function CartProvider({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [lines, setLines] = useState<CartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return normalizeCart(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(lines));
      } catch {
        /* Le panier reste utilisable en mémoire. */
      }
  }, [lines, ready]);
  function add(id: string, quantity = 1) {
    setLines((old) => {
      const existing = old.find((l) => l.id === id);
      return normalizeCart(
        existing
          ? old.map((l) =>
              l.id === id ? { id, quantity: l.quantity + quantity } : l,
            )
          : [...old, { id, quantity }],
      );
    });
    setNotice("Article ajouté au panier de démonstration.");
  }
  function update(id: string, quantity: number) {
    setLines((old) =>
      normalizeCart(old.map((l) => (l.id === id ? { id, quantity } : l))),
    );
    setNotice(quantity === 0 ? "Article retiré." : "Quantité mise à jour.");
  }
  return (
    <Context.Provider value={{ lines, ready, add, update, notice }}>
      {children}
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
    </Context.Provider>
  );
}
export const useCart = () => useContext(Context);
