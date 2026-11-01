import Image from "next/image";
import Link from "next/link";
import { categories, products } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { Icon } from "@/components/icons";
export default function Home() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-dot" /> LE QUOTIDIEN, AUTREMENT
          </span>
          <h1>
            Vos envies.
            <br />
            Vos essentiels.
            <br />
            <em>Votre SHENA.</em>
          </h1>
          <p>
            De la pièce qui vous ressemble à l’idée qui vous fait avancer.
            Découvrez une sélection pensée pour votre quotidien, en Haïti.
          </p>
          <Link className="button" href="/boutique">
            Explorer la boutique <Icon name="arrow" />
          </Link>
          <div className="hero-caption">
            Mode · Tech · Beauté · Maison · Numérique
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-art-title">
            La sélection
            <br />
            <em>des beaux jours.</em>
          </div>
          <Image
            className="hero-shoe"
            src="/products/sneakers.svg"
            alt="Illustration des sneakers SHENA de démonstration"
            width={520}
            height={520}
            priority
          />
          <div className="hero-stamp">
            SÉLECTION SHENA
            <br />
            <b>01 / 05</b>
          </div>
          <Link href="/produit/sneakers-shena-demo" className="hero-product">
            <span>
              Sneakers SHENA<small>Découvrir le modèle de démonstration</small>
            </span>
            <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <div className="benefits shell">
        <div>
          <Icon name="truck" />
          <span>
            Livraison en Haïti
            <small>Modalités à confirmer avant le lancement</small>
          </span>
        </div>
        <div>
          <Icon name="download" />
          <span>
            Un univers numérique<small>Des ressources pour vos projets</small>
          </span>
        </div>
        <div>
          <Icon name="check" />
          <span>
            Des informations claires
            <small>Prix et disponibilité visibles</small>
          </span>
        </div>
      </div>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">À CHAQUE ENVIE, SON UNIVERS</span>
            <h2>Qu’allez-vous découvrir ?</h2>
          </div>
          <Link className="text-link" href="/boutique">
            Tout explorer <Icon name="arrow" />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((c, i) => (
            <Link
              href={
                c.slug === "numerique"
                  ? "/numerique"
                  : `/boutique?category=${c.slug}`
              }
              className="category-card"
              key={c.slug}
            >
              <div style={{ background: c.color }}>
                <Image
                  src={`/products/${["bag", "headphones", "beauty", "vase", "planner"][i]}.svg`}
                  alt=""
                  width={240}
                  height={240}
                />
                <span>{c.mark}</span>
              </div>
              <h3>
                {c.name}
                <Icon name="arrow" />
              </h3>
            </Link>
          ))}
        </div>
      </section>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LA SÉLECTION SHENA</span>
            <h2>Des essentiels à découvrir.</h2>
          </div>
          <Link href="/boutique" className="text-link">
            Voir le catalogue <Icon name="arrow" />
          </Link>
        </div>
        <p className="section-intro">
          Un premier aperçu de nos univers. Tous les articles présentés sont des
          exemples de démonstration.
        </p>
        <div className="product-grid">
          {products
            .filter((p) => p.featured)
            .slice(0, 4)
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section className="digital-banner shell">
        <div className="digital-copy">
          <span className="eyebrow">
            SHENA STUDIO / LE DÉPARTEMENT NUMÉRIQUE
          </span>
          <h2>
            Vos idées méritent
            <br />
            <em>de prendre forme.</em>
          </h2>
          <p>
            Planners, guides et modèles pratiques : découvrez des ressources
            pour créer, apprendre et vous organiser.
          </p>
          <Link className="button light" href="/numerique">
            Explorer les produits numériques <Icon name="arrow" />
          </Link>
          <small>Aperçus de démonstration · Téléchargements à venir</small>
        </div>
        <div className="digital-art">
          <Image
            src="/products/planner.svg"
            alt="Aperçu illustré du planner essentiel"
            width={450}
            height={450}
          />
          <span className="format-tag">PDF · MODÈLES · RESSOURCES</span>
        </div>
      </section>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">POUR LA MAISON & POUR SOI</span>
            <h2>Les petits détails qui comptent.</h2>
          </div>
          <Link className="text-link" href="/boutique?sort=newest">
            Les nouveautés <Icon name="arrow" />
          </Link>
        </div>
        <div className="product-grid">
          {products
            .filter((p) =>
              [
                "home-demo",
                "beauty-demo",
                "planner-demo",
                "template-demo",
              ].includes(p.id),
            )
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      </section>
      <section className="order-banner shell">
        <div>
          <span className="eyebrow">UNE AUTRE FAÇON DE CHOISIR</span>
          <h2>
            Votre prochain coup de cœur,
            <br />
            sur commande.
          </h2>
          <p>
            Des articles à découvrir avec un délai annoncé et une disponibilité
            à confirmer.
          </p>
        </div>
        <Link href="/boutique?type=preorder" className="button outline">
          Découvrir la sélection <Icon name="arrow" />
        </Link>
      </section>
      <section className="section shell story">
        <span className="eyebrow">BIENVENUE DANS VOTRE QUOTIDIEN</span>
        <h2>
          Une boutique, plusieurs univers.
          <br />
          La même attention pour vous.
        </h2>
        <p>
          SHENA se construit autour d’une idée simple : rendre les produits du
          quotidien et les ressources numériques plus faciles à découvrir en
          Haïti.
        </p>
        <Link className="text-link" href="/informations/a-propos">
          L’esprit SHENA <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}
