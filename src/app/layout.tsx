import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { CartProvider } from "@/components/cart-provider";
import { loadCatalog } from "@/lib/supabase/catalog";
import { CatalogProvider } from "@/components/catalog-provider";
import "./globals.css";
import "./premium.css";
import { LocationProvider } from "@/components/location-provider";
export const metadata: Metadata = {
  metadataBase: new URL("https://shena.com"),
  title: {
    default: "SHENA — Tous vos univers, au même endroit.",
    template: "%s | SHENA",
  },
  description:
    "Découvrez l’univers SHENA : mode, technologie, beauté, maison et ressources numériques pour Haïti. Catalogue SHENA.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await loadCatalog();
  const isStaging =
    process.env.VERCEL_ENV === "preview" ||
    process.env.SHENA_DEPLOYMENT_TARGET === "staging";
  return (
    <html lang="fr">
      <body>
        <CatalogProvider state={state}>
          <CartProvider key={state.mode}>
            <LocationProvider>
              <a className="skip-link" href="#contenu">
                Aller au contenu
              </a>
              {isStaging && (
                <aside
                  className="staging-notice"
                  aria-label="Environnement de test"
                >
                  SHENA STAGING · Tests uniquement · Utilisez des données
                  fictives · Aucun paiement réel
                </aside>
              )}
              <Header />
              <main id="contenu">{children}</main>
              <footer className="footer">
                <div className="shell footer-grid">
                  <div>
                    <Link className="logo" href="/">
                      SHENA<span>•</span>
                    </Link>
                    <p>
                      Tous vos univers.
                      <br />
                      Au même endroit.
                    </p>
                    <span className="eyebrow">
                      Pensé pour Haïti · Prix en HTG
                    </span>
                  </div>
                  <div>
                    <h2>Explorer</h2>
                    <Link href="/boutique">La boutique</Link>
                    <Link href="/numerique">SHENA Digital</Link>
                    <Link href="/boutique?type=preorder">Sur commande</Link>
                  </div>
                  <div>
                    <h2>À vos côtés</h2>
                    <Link href="/informations/a-propos">À propos de SHENA</Link>
                    <Link href="/informations/livraison">
                      Livraison & retours
                    </Link>
                    <Link href="/informations/numerique">
                      Licences numériques
                    </Link>
                  </div>
                  <div>
                    <h2>En toute transparence</h2>
                    <Link href="/informations/conditions">
                      Conditions de vente
                    </Link>
                    <Link href="/informations/confidentialite">
                      Confidentialité
                    </Link>
                    <p className="footer-note">
                      {state.mode === "demo"
                        ? "Version de démonstration."
                        : "Catalogue SHENA."}
                      <br />
                      Comptes et paiements à venir.
                    </p>
                  </div>
                </div>
                <div className="shell footer-bottom">
                  <span>© {new Date().getFullYear()} SHENA</span>
                  <span>
                    {state.mode === "demo"
                      ? "Visuels, produits et prix de démonstration"
                      : "Prix en HTG · Aucun paiement en ligne activé"}
                  </span>
                </div>
              </footer>
            </LocationProvider>
          </CartProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}
