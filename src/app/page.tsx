import Image from "next/image";
import Link from "next/link";
import { products } from "@/lib/catalog";
import { ProductVisual } from "@/components/product-visual";
import { ProductCard } from "@/components/product-card";
import { ProductRail } from "@/components/product-rail";
import { NearbyProducts } from "@/components/nearby-products";
import { Icon } from "@/components/icons";
const universes = [
  {
    name: "Mode",
    hint: "Le style au quotidien",
    image: "sneakers",
    href: "/boutique?category=mode",
  },
  {
    name: "Électronique",
    hint: "Toujours connecté",
    image: "headphones",
    href: "/boutique?category=electronique",
  },
  {
    name: "Beauté",
    hint: "Du temps pour vous",
    image: "beauty",
    href: "/boutique?category=beaute",
  },
  {
    name: "Maison",
    hint: "Bien chez soi",
    image: "vase",
    href: "/boutique?category=maison",
  },
  {
    name: "Accessoires",
    hint: "Le détail qui change tout",
    image: "bag",
    href: "/boutique?category=mode&q=sac",
  },
  {
    name: "SHENA Digital",
    hint: "Vos idées prennent vie",
    image: "planner",
    href: "/numerique",
  },
];
export default function Home() {
  return (
    <>
      <section className="premium-hero shell">
        <div className="hero-campaign">
          <Image
            src="/products/campaign-premium.png"
            alt="Composition studio générée pour la campagne SHENA : mode, casque et soins de démonstration"
            fill
            sizes="(max-width: 800px) 100vw, 75vw"
            priority
          />
          <div className="hero-campaign-copy">
            <span className="campaign-label">
              BIENVENUE DANS VOTRE NOUVEL UNIVERS
            </span>
            <h1>
              Tout ce que
              <br />
              vous aimez.
              <br />
              <em>Plus près de vous.</em>
            </h1>
            <p>
              Les essentiels du quotidien.
              <br />
              Les découvertes qui font plaisir.
              <br />
              Une boutique pensée pour Haïti.
            </p>
            <Link href="/boutique" className="button">
              Explorer la boutique <Icon name="arrow" />
            </Link>
            <span className="hero-demo">
              Campagne & produits de démonstration
            </span>
          </div>
          <div className="campaign-bottom">
            <span>MODE</span>
            <span>TECH</span>
            <span>BEAUTÉ</span>
            <span>MAISON</span>
            <span>DIGITAL</span>
          </div>
        </div>
        <div className="premium-side">
          <Link
            className="premium-side-tech"
            href="/boutique?category=electronique"
          >
            <div>
              <span className="eyebrow">BRANCHEZ VOS ENVIES</span>
              <h2>
                Le son qui
                <br />
                vous suit.
              </h2>
              <b>
                Explorer la tech <Icon name="arrow" />
              </b>
            </div>
            <ProductVisual image="headphones" name="Casque de démonstration" />
          </Link>
          <Link
            className="premium-side-beauty"
            href="/boutique?category=beaute"
          >
            <div>
              <span className="eyebrow">LE RITUEL DU QUOTIDIEN</span>
              <h2>
                Une pause.
                <br />
                Juste pour vous.
              </h2>
              <b>
                Découvrir la beauté <Icon name="arrow" />
              </b>
            </div>
            <ProductVisual image="beauty" name="Soins de démonstration" />
          </Link>
        </div>
      </section>
      <section className="universe-section shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LE MONDE SHENA</span>
            <h2>Une envie ? Entrez dans votre univers.</h2>
          </div>
          <Link href="/boutique" className="text-link">
            Tous les rayons <Icon name="arrow" />
          </Link>
        </div>
        <div className="universe-grid">
          {universes.map((c, i) => (
            <Link
              href={c.href}
              key={c.name}
              className={`universe-tile universe-${i}`}
            >
              <div className="universe-image">
                <ProductVisual image={c.image} name={c.name} />
              </div>
              <div>
                <h3>{c.name}</h3>
                <p>{c.hint}</p>
              </div>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      </section>
      <ProductRail
        title="Nos dernières découvertes"
        kicker="NOUVEAUTÉS DE DÉMONSTRATION"
        href="/boutique?sort=newest"
        items={[
          products[0],
          products[1],
          products[2],
          products[5],
          products[4],
        ]}
      />
      <NearbyProducts />
      <section className="tech-destination">
        <div className="shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LE QUOTIDIEN, EN MIEUX CONNECTÉ</span>
              <h2>Un peu de tech. Beaucoup de possibilités.</h2>
            </div>
            <Link className="text-link" href="/boutique?category=electronique">
              Le rayon électronique <Icon name="arrow" />
            </Link>
          </div>
          <div className="tech-composition">
            <Link href="/produit/enceinte-nomade" className="tech-feature">
              <div>
                <span>VOTRE MUSIQUE. VOTRE RYTHME.</span>
                <h3>
                  Le plaisir
                  <br />
                  d’emporter le son.
                </h3>
                <p>Découvrez l’enceinte nomade.</p>
                <b>Voir le produit →</b>
                <small>Sur commande · Démonstration</small>
              </div>
              <ProductVisual
                image="speaker"
                name="Enceinte nomade de démonstration"
              />
            </Link>
            <div className="tech-products">
              {products
                .filter((p) => p.category === "electronique")
                .map((p) => (
                  <ProductCard product={p} key={p.id} />
                ))}
            </div>
          </div>
        </div>
      </section>
      <section className="lifestyle-section shell">
        <div className="lifestyle-fashion">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FAITES-LE À VOTRE FAÇON</span>
              <h2>Le style, c’est vous.</h2>
            </div>
            <Link href="/boutique?category=mode" className="text-link">
              Mode & accessoires →
            </Link>
          </div>
          <div className="fashion-products">
            {products
              .filter((p) => p.category === "mode")
              .map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
          </div>
        </div>
        <div className="lifestyle-beauty">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BEAUTÉ & SOINS</span>
              <h2>Vos petits rituels.</h2>
            </div>
          </div>
          <Link href="/produit/rituel-douceur" className="beauty-feature">
            <ProductVisual
              image="beauty"
              name="Rituel douceur de démonstration"
            />
            <div>
              <span className="eyebrow">PRENDRE SOIN DE SOI</span>
              <h3>
                La douceur a<br />
                toute sa place.
              </h3>
              <p>Une sélection à explorer, un moment à savourer.</p>
              <b>
                Découvrir le rituel <Icon name="arrow" />
              </b>
              <small>Produit de démonstration · Aucun achat réel</small>
            </div>
          </Link>
        </div>
      </section>
      <section className="digital-portal shell">
        <div className="digital-portal-copy">
          <span className="digital-wordmark">
            SHENA <b>Digital</b>
            <sup>✦</sup>
          </span>
          <span className="portal-kicker">CRÉEZ. APPRENEZ. AVANCEZ.</span>
          <h2>
            Vos idées n’ont
            <br />
            plus qu’à se lancer.
          </h2>
          <p>
            Guides, planners et modèles : des ressources pour passer de « un
            jour » à votre prochain projet.
          </p>
          <div className="digital-feature-tags">
            <span>E-books & guides</span>
            <span>Word & Excel</span>
            <span>Canva & ressources</span>
          </div>
          <Link className="button" href="/numerique">
            Entrer dans SHENA Digital <Icon name="arrow" />
          </Link>
          <small>Sans livraison physique · Accès numérique à venir</small>
        </div>
        <div className="portal-covers">
          {products
            .filter((p) => p.type === "digital")
            .map((p) => (
              <Link href={`/produit/${p.slug}`} key={p.id}>
                <ProductVisual image={p.image} name={p.name} />
                <div>
                  <span>{p.formats}</span>
                  <h3>{p.name}</h3>
                  <b>Découvrir →</b>
                </div>
              </Link>
            ))}
        </div>
      </section>
      <section className="home-destination shell">
        <Link href="/boutique?category=maison" className="home-feature">
          <ProductVisual image="vase" name="Vase de démonstration" />
          <div>
            <span className="eyebrow">MAISON & QUOTIDIEN</span>
            <h2>
              Votre maison.
              <br />
              Votre équilibre.
            </h2>
            <p>Des objets simples qui changent l’ambiance.</p>
            <b>
              Explorer la maison <Icon name="arrow" />
            </b>
          </div>
        </Link>
        <div className="delivery-story">
          <span className="eyebrow">SHENA, À TRAVERS HAÏTI</span>
          <h2>
            Plusieurs villes.
            <br />
            Une même attention.
          </h2>
          <div className="city-tags">
            <span>Hinche</span>
            <span>Port-au-Prince</span>
            <span>Cap-Haïtien</span>
            <span>Les Cayes</span>
            <span>Maïssade</span>
          </div>
          <p>
            Choisissez votre commune pour découvrir la répartition des stocks
            fictifs. Les tarifs et options de livraison seront confirmés avant
            toute vente.
          </p>
          <Link href="/informations/livraison" className="text-link">
            Comprendre la livraison <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <ProductRail
        title="À découvrir sur commande"
        kicker="UN COUP DE CŒUR QUI SE PRÉPARE"
        href="/boutique?type=preorder"
        items={products.filter((p) => p.type === "preorder")}
      />
      <section className="shell market-benefits">
        <div>
          <Icon name="pin" />
          <h3>Votre commune, d’abord</h3>
          <p>Une sélection manuelle, sans demande de GPS.</p>
        </div>
        <div>
          <Icon name="truck" />
          <h3>Une livraison expliquée</h3>
          <p>Origines visibles. Tarifs et desserte à confirmer.</p>
        </div>
        <div>
          <Icon name="download" />
          <h3>Un vrai univers digital</h3>
          <p>Formats, aperçus et licences sur chaque fiche.</p>
        </div>
        <div>
          <Icon name="check" />
          <h3>En toute transparence</h3>
          <p>Produits fictifs. Aucun paiement ni achat réel.</p>
        </div>
      </section>
    </>
  );
}
