import Link from "next/link";
import { categories, money, type Product } from "@/lib/catalog";
import { ProductVisual } from "./product-visual";
import { ProductAvailability } from "./product-availability";
import { QuickAdd } from "./quick-add";
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <article
      className={`product-card ${p.type === "digital" ? "digital-product-card" : ""}`}
    >
      <Link href={`/produit/${p.slug}`} className="product-image">
        <ProductVisual
          image={p.image}
          name={p.name}
          url={p.imageUrl}
          live={p.source === "supabase"}
        />
        <span className={`badge ${p.type}`}>
          {p.type === "unknown"
            ? "Type à vérifier"
            : p.type === "digital"
              ? "Numérique"
              : p.type === "preorder"
                ? "Sur commande"
                : p.source === "supabase"
                  ? "Stock global"
                  : "Stock démo"}
        </span>
      </Link>
      <div className="product-card-body">
        <div className="product-meta">
          {p.categoryLabel ||
            categories.find((c) => c.slug === p.category)?.short ||
            "Autres produits"}
          {p.formats && <span className="format-pill">{p.formats}</span>}
        </div>
        <h3>
          <Link href={`/produit/${p.slug}`}>{p.name}</Link>
        </h3>
        <p className="price">{money(p.price)}</p>
        <ProductAvailability product={p} />
        {p.type === "digital" && (
          <p className="card-license">Licence personnelle · {p.size}</p>
        )}
        <QuickAdd
          id={p.id}
          name={p.name}
          disabled={
            p.type === "unknown" || (p.type === "stock" && p.stock === 0)
          }
        />
        <span className="card-demo">
          {p.source === "supabase"
            ? "Commandes indisponibles · Panier local"
            : "Démonstration · Aucun achat réel"}
        </span>
      </div>
    </article>
  );
}
