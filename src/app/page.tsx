import Link from "next/link";
import { categories, products } from "@/lib/catalog";
import { ProductVisual } from "@/components/product-visual";
import { ProductRail } from "@/components/product-rail";
import { ProductCard } from "@/components/product-card";
import { Icon } from "@/components/icons";
export default function Home() {
  return (
    <>
      <div className="shell campaign-layout">
        <aside className="department-menu">
          <h2>Explorez nos rayons</h2>
          {categories.map((c, i) => (
            <Link
              href={
                c.slug === "numerique"
                  ? "/numerique"
                  : `/boutique?category=${c.slug}`
              }
              key={c.slug}
            >
              <span className="department-icon">
                {["◈", "◉", "❋", "⌂", "✦"][i]}
              </span>
              {c.name}
              <Icon name="arrow" />
            </Link>
          ))}
          <div className="department-note">
            <Icon name="truck" />
            <p>
              Pensé pour Haïti<small>Livraison : modalités à venir</small>
            </p>
          </div>
        </aside>
        <section className="main-campaign">
          <div className="campaign-copy">
            <span className="campaign-label">LES DÉCOUVERTES SHENA</span>
            <h1>
              Tout pour vous.
              <br />
              Tout pour votre
              <br />
              <em>quotidien.</em>
            </h1>
            <p>
              Mode, tech, beauté et plus encore.
              <br />
              Vos univers préférés, au même endroit.
            </p>
            <Link className="button" href="/boutique">
              Je découvre <Icon name="arrow" />
            </Link>
            <small>Une sélection de démonstration à explorer</small>
          </div>
          <div className="campaign-product">
            <ProductVisual
              image="headphones"
              name="Casque sans fil de démonstration"
              priority
            />
            <div className="campaign-product-label">
              <span>LE SON, PARTOUT AVEC VOUS</span>
              <strong>Casque sans fil Studio</strong>
              <Link href="/produit/casque-sans-fil">
                Découvrir le produit →
              </Link>
            </div>
          </div>
        </section>
        <div className="side-campaigns">
          <Link
            href="/boutique?category=beaute"
            className="side-campaign beauty-campaign"
          >
            <div>
              <span>BEAUTÉ & SOINS</span>
              <h2>
                Votre moment
                <br />à vous.
              </h2>
              <b>
                Explorer <Icon name="arrow" />
              </b>
            </div>
            <ProductVisual image="beauty" name="Soins de démonstration" />
          </Link>
          <Link href="/numerique" className="side-campaign digital-campaign">
            <div>
              <span>✦ SHENA DIGITAL</span>
              <h2>
                De grandes idées.
                <br />
                Les bons outils.
              </h2>
              <b>
                Découvrir <Icon name="arrow" />
              </b>
            </div>
            <div className="mini-document">
              PDF
              <br />
              <strong>Aa</strong>
              <i />
              <i />
            </div>
          </Link>
        </div>
      </div>
      <section className="market-section shell category-section">
        <div className="section-heading">
          <h2>À chaque envie, son rayon</h2>
          <Link href="/boutique" className="text-link">
            Toute la boutique <Icon name="arrow" />
          </Link>
        </div>
        <div className="category-grid">
          {categories.map((c, i) => (
            <Link
              className="category-card"
              href={
                c.slug === "numerique"
                  ? "/numerique"
                  : `/boutique?category=${c.slug}`
              }
              key={c.slug}
            >
              <div>
                <ProductVisual
                  image={
                    ["sneakers", "headphones", "beauty", "vase", "planner"][i]
                  }
                  name={c.name}
                />
              </div>
              <h3>{c.slug === "numerique" ? "SHENA Digital" : c.name}</h3>
              <span>
                {
                  [
                    "Votre style, vos essentiels",
                    "Connectez votre quotidien",
                    "Prenez soin de vous",
                    "Bien chez vous",
                    "Créez, apprenez, avancez",
                  ][i]
                }
              </span>
            </Link>
          ))}
        </div>
      </section>
      <ProductRail
        title="Les nouveautés à découvrir"
        kicker="DU NOUVEAU DANS VOS RAYONS"
        href="/boutique?sort=newest"
        items={[...products].reverse().slice(0, 5)}
      />
      <div className="shell merchandising-banners">
        <Link
          href="/boutique?category=electronique"
          className="wide-campaign tech-wide"
        >
          <div>
            <span className="eyebrow">ÉLECTRONIQUE & GADGETS</span>
            <h2>
              Le bon son.
              <br />
              Le bon compagnon.
            </h2>
            <span className="banner-cta">
              Explorer la tech <Icon name="arrow" />
            </span>
          </div>
          <ProductVisual image="speaker" name="Enceinte de démonstration" />
        </Link>
        <Link
          href="/boutique?category=mode"
          className="wide-campaign fashion-wide"
        >
          <div>
            <span className="eyebrow">MODE & ACCESSOIRES</span>
            <h2>
              Votre style.
              <br />
              Sans compromis.
            </h2>
            <span className="banner-cta">
              Trouver mon essentiel <Icon name="arrow" />
            </span>
          </div>
          <ProductVisual image="bag" name="Sac de démonstration" />
        </Link>
      </div>
      <ProductRail
        title="Les essentiels de la sélection"
        kicker="À EXPLORER EN CE MOMENT · SÉLECTION ÉDITORIALE"
        href="/boutique"
        items={products.filter((p) => p.featured).slice(0, 5)}
      />
      <section className="market-section shell digital-showcase">
        <div className="digital-showcase-intro">
          <span className="digital-wordmark">
            SHENA <b>Digital</b>
            <sup>✦</sup>
          </span>
          <h2>
            Vos projets prennent
            <br />
            une nouvelle dimension.
          </h2>
          <p>
            E-books, planners, templates et ressources : des outils pour
            apprendre, créer et avancer.
          </p>
          <div className="digital-feature-tags">
            <span>PDF & e-books</span>
            <span>Word & Excel</span>
            <span>Planners & modèles</span>
          </div>
          <Link href="/numerique" className="button">
            Explorer SHENA Digital <Icon name="arrow" />
          </Link>
          <small>
            Aperçus de démonstration · Aucun téléchargement disponible
          </small>
        </div>
        <div className="digital-feature-products">
          {products
            .filter((p) => p.type === "digital")
            .map((p) => (
              <Link href={`/produit/${p.slug}`} key={p.id}>
                <ProductVisual image={p.image} name={p.name} />
                <span>
                  {p.name} <Icon name="arrow" />
                </span>
              </Link>
            ))}
        </div>
      </section>
      <div className="department-sections shell">
        {categories
          .filter((c) => c.slug !== "numerique")
          .map((c) => {
            const items = products.filter((p) => p.category === c.slug);
            return (
              <section className="department-section" key={c.slug}>
                <div className="section-heading">
                  <h2>{c.name}</h2>
                  <Link
                    className="text-link"
                    href={`/boutique?category=${c.slug}`}
                  >
                    Tout voir <Icon name="arrow" />
                  </Link>
                </div>
                <div className="department-products">
                  {items.map((p) => (
                    <ProductCard product={p} key={p.id} />
                  ))}
                  {items.length === 1 && (
                    <div className={`department-discovery ${c.slug}`}>
                      <span className="eyebrow">DÉCOUVREZ VOTRE UNIVERS</span>
                      <h3>
                        {c.slug === "beaute"
                          ? "Les petits rituels font les belles journées."
                          : "Du beau, du pratique. Tout simplement."}
                      </h3>
                      <p>
                        {c.slug === "beaute"
                          ? "Soins, beauté et moments pour soi. Un rayon qui se prépare pour vous."
                          : "Des objets bien choisis pour se sentir bien chez soi."}
                      </p>
                      <Link
                        className="text-link"
                        href={`/boutique?category=${c.slug}`}
                      >
                        Explorer le rayon <Icon name="arrow" />
                      </Link>
                      <small>La sélection sera enrichie avant lancement.</small>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
      </div>
      <ProductRail
        title="À découvrir sur commande"
        kicker="UN DÉLAI ANNONCÉ, UNE DISPONIBILITÉ À CONFIRMER"
        href="/boutique?type=preorder"
        items={products.filter((p) => p.type === "preorder")}
      />
      <section className="shell market-benefits">
        <div>
          <Icon name="truck" />
          <h3>Pensé pour Haïti</h3>
          <p>Zones et frais de livraison à confirmer avant lancement.</p>
        </div>
        <div>
          <Icon name="download" />
          <h3>Physique & numérique</h3>
          <p>Vos essentiels et vos ressources, dans une même boutique.</p>
        </div>
        <div>
          <Icon name="check" />
          <h3>En toute transparence</h3>
          <p>Catalogue de démonstration. Aucun achat ni paiement réel.</p>
        </div>
        <div>
          <Icon name="bag" />
          <h3>Un panier à votre rythme</h3>
          <p>Conservez votre sélection sur cet appareil.</p>
        </div>
      </section>
    </>
  );
}
