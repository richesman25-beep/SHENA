import Link from "next/link";
import { categories, money, type Product } from "@/lib/catalog";
import { ProductVisual } from "./product-visual";
import { QuickAdd } from "./quick-add";
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <article
      className={`product-card ${p.type === "digital" ? "digital-product-card" : ""}`}
    >
      <Link href={`/produit/${p.slug}`} className="product-image">
        <ProductVisual image={p.image} name={p.name} />
        <span className={`badge ${p.type}`}>
          {p.type === "digital"
            ? "Numérique"
            : p.type === "preorder"
              ? "Sur commande"
              : "Collection démo"}
        </span>
      </Link>
      <div className="product-card-body">
        <div className="product-meta">
          {categories.find((c) => c.slug === p.category)?.short}
          {p.formats && <span className="format-pill">{p.formats}</span>}
        </div>
        <h3>
          <Link href={`/produit/${p.slug}`}>{p.name}</Link>
        </h3>
        <p className="price">{money(p.price)}</p>
        <p className={`availability ${p.type}`}>
          <span />
          {p.type === "digital"
            ? "Aperçu · Livraison numérique à venir"
            : p.type === "preorder"
              ? "Disponibilité à confirmer"
              : `Stock démo : ${p.stock} unités`}
        </p>
        {p.type === "digital" && (
          <p className="card-license">Licence personnelle · {p.size}</p>
        )}
        <QuickAdd id={p.id} name={p.name} />
        <span className="card-demo">Démonstration · Aucun achat réel</span>
      </div>
    </article>
  );
}
