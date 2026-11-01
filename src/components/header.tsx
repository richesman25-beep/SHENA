"use client";
import Link from "next/link";
import { useCatalog } from "./catalog-provider";
import { storefront } from "@/lib/storefront";
import { useCart } from "./cart-provider";
import { LocationPicker } from "./location-picker";
import { Icon } from "./icons";
export function Header() {
  const { mode, categories } = useCatalog();
  const { lines, ready } = useCart();
  return (
    <>
      <div className="announcement">
        <div className="shell">
          <span>{storefront.announcement}</span>
          <span>Haïti · Français · HTG</span>
        </div>
      </div>
      <header className="header shell">
        <Link href="/" className="logo" aria-label="SHENA, accueil">
          <span className="logo-symbol">S</span>SHENA<span>●</span>
          <small>VOTRE MONDE. PLUS PROCHE.</small>
        </Link>
        <LocationPicker />
        <form action="/boutique" className="header-search">
          <label className="sr-only" htmlFor="search-category">
            Catégorie de recherche
          </label>
          <select id="search-category" name="category">
            <option value="">Tout</option>
            {categories.map((c) => (
              <option value={c.slug} key={c.slug}>
                {c.short}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="search">
            Rechercher un produit
          </label>
          <input
            id="search"
            name="q"
            placeholder="Rechercher un produit, une envie…"
          />
          <button aria-label="Lancer la recherche">
            <Icon name="search" />
          </button>
        </form>
        <div className="header-actions">
          <button
            className="header-disabled"
            disabled
            title="Les comptes clients ne sont pas encore disponibles"
          >
            <Icon name="user" />
            <span>
              Mon compte<small>Bientôt disponible</small>
            </span>
          </button>
          <button
            className="header-disabled favorites"
            disabled
            title="Les favoris ne sont pas encore disponibles"
          >
            <Icon name="heart" />
            <span>
              Favoris<small>Bientôt</small>
            </span>
          </button>
          <Link
            className="bag-link"
            href="/panier"
            aria-label={`Panier, ${ready ? lines.reduce((s, l) => s + l.quantity, 0) : 0} articles`}
          >
            <span className="bag-icon">
              <Icon name="bag" />
              <b>{ready ? lines.reduce((s, l) => s + l.quantity, 0) : 0}</b>
            </span>
            <span>
              Mon panier<small>Votre sélection</small>
            </span>
          </Link>
        </div>
      </header>
      <nav className="navigation" aria-label="Navigation principale">
        <div className="shell nav-inner">
          <Link className="all-categories" href="/boutique">
            <Icon name="menu" />
            Tous les rayons
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={
                c.slug === "numerique"
                  ? "/numerique"
                  : `/boutique?category=${c.slug}`
              }
              className={c.slug === "numerique" ? "nav-digital" : ""}
            >
              {c.slug === "numerique" ? "✦ SHENA Digital" : c.name}
            </Link>
          ))}
          <Link href="/boutique?type=preorder">Sur commande</Link>
        </div>
      </nav>
      <div className="location-mobile shell">
        <LocationPicker compact />
        <span>Stocks de démonstration · Sans GPS</span>
      </div>
      <div className="demo-strip">
        {mode === "demo"
          ? storefront.disclaimer
          : "Mode catalogue réel · Commandes et paiements indisponibles · Géographie en préparation"}
      </div>
    </>
  );
}
