"use client";
import { createContext, useContext } from "react";
import type { CatalogState } from "@/lib/catalog-state";
const Context = createContext<CatalogState>({
  mode: "live",
  status: "unconfigured",
  products: [],
  categories: [],
});
export function CatalogProvider({
  state,
  children,
}: {
  state: CatalogState;
  children: React.ReactNode;
}) {
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const useCatalog = () => useContext(Context);
