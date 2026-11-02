"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  useMemo,
} from "react";
import { useCatalog } from "./catalog-provider";
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
  const { products, mode, status } = useCatalog();
  const storageKey = key + "." + mode;
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [lines, setLines] = useState<CartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return normalizeCart(
        JSON.parse(
          localStorage.getItem(storageKey) ||
            (mode === "demo" ? localStorage.getItem(key) : null) ||
            "[]",
        ),
        products,
      );
    } catch {
      return [];
    }
  });
  const ready = hydrated && status === "ready";
  const normalizedLines = useMemo(
    () => normalizeCart(lines, products),
    [lines, products],
  );
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalizedLines));
      } catch {
        /* Le panier reste utilisable en mémoire. */
      }
  }, [normalizedLines, ready, storageKey]);
  function add(id: string, quantity = 1) {
    setLines((old) => {
      const existing = old.find((l) => l.id === id);
      return normalizeCart(
        existing
          ? old.map((l) =>
              l.id === id ? { id, quantity: l.quantity + quantity } : l,
            )
          : [...old, { id, quantity }],
        products,
      );
    });
    setNotice(
      mode === "demo"
        ? "Article ajouté au panier de démonstration."
        : "Article ajouté au panier local. Les prix seront vérifiés côté serveur.",
    );
  }
  function update(id: string, quantity: number) {
    setLines((old) =>
      normalizeCart(
        old.map((l) => (l.id === id ? { id, quantity } : l)),
        products,
      ),
    );
    setNotice(quantity === 0 ? "Article retiré." : "Quantité mise à jour.");
  }
  return (
    <Context.Provider
      value={{ lines: normalizedLines, ready, add, update, notice }}
    >
      {children}
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
    </Context.Provider>
  );
}
export const useCart = () => useContext(Context);
