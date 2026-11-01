import Image from "next/image";
import Link from "next/link";
import { categories, money, typeLabel, type Product } from "@/lib/catalog";
import { Icon } from "./icons";
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <article className="product-card">
      <Link href={`/produit/${p.slug}`} className="product-image">
        <Image
          src={`/products/${p.image}.svg`}
          alt={`Illustration de démonstration : ${p.name}`}
          width={420}
          height={420}
        />
        <span className={`badge ${p.type}`}>{typeLabel(p.type)}</span>
        <span className="product-open">
          <Icon name="arrow" />
        </span>
      </Link>
      <div className="product-meta">
        {categories.find((c) => c.slug === p.category)?.short}{" "}
        <span>· {p.brand}</span>
      </div>
      <h3>
        <Link href={`/produit/${p.slug}`}>{p.name}</Link>
      </h3>
      <p className="price">{money(p.price)}</p>
    </article>
  );
}
