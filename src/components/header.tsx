"use client";
import Link from "next/link";
import { categories } from "@/lib/catalog";
import { useCart } from "./cart-provider";
import { Icon } from "./icons";
export function Header() {
  const { lines, ready } = useCart();
  return (
    <>
      <div className="announcement">
        Bienvenue chez SHENA · Une nouvelle façon de découvrir, en Haïti.{" "}
        <span>Catalogue de démonstration — achats indisponibles</span>
      </div>
      <header className="header shell">
        <Link href="/" className="logo" aria-label="SHENA, accueil">
          SHENA<span>•</span>
        </Link>
        <form action="/boutique" className="header-search">
          <label htmlFor="search" className="sr-only">
            Rechercher un produit
          </label>
          <Icon name="search" />
          <input id="search" name="q" placeholder="Une envie, un essentiel…" />
          <button type="submit" aria-label="Lancer la recherche">
            <Icon name="arrow" />
          </button>
        </form>
        <div className="header-actions">
          <Link className="help-link" href="/informations/a-propos">
            L’esprit SHENA
          </Link>
          <Link
            className="bag-link"
            href="/panier"
            aria-label={`Panier, ${ready ? lines.reduce((s, l) => s + l.quantity, 0) : 0} articles`}
          >
            <Icon name="bag" />
            <span>Panier</span>
            <b>{ready ? lines.reduce((s, l) => s + l.quantity, 0) : 0}</b>
          </Link>
        </div>
      </header>
      <nav className="navigation" aria-label="Navigation principale">
        <div className="shell nav-inner">
          <Link href="/boutique" className="all-categories">
            <Icon name="menu" />
            Toute la boutique
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={
                c.slug === "numerique"
                  ? "/numerique"
                  : `/boutique?category=${c.slug}`
              }
            >
              {c.name}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
