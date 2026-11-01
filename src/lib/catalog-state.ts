import type { Product } from "./catalog";
export type CatalogState = {
  mode: "demo" | "live";
  status: "ready" | "unconfigured" | "error";
  products: Product[];
  message?: string;
  categories: {
    slug: string;
    name: string;
    short: string;
    mark: string;
    color: string;
  }[];
};
