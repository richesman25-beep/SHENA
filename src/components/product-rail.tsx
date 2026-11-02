import Link from "next/link";
import { type Product } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { Icon } from "./icons";
export function ProductRail({
  title,
  kicker,
  href,
  items,
  id,
}: {
  title: string;
  kicker: string;
  href: string;
  items: Product[];
  id?: string;
}) {
  return (
    <section className="market-section shell" id={id}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <Link className="text-link" href={href}>
          Tout voir <Icon name="arrow" />
        </Link>
      </div>
      <div className={`product-rail ${items.length < 4 ? "short-rail" : ""}`}>
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
