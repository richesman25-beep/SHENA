# Refonte UI/UX SHENA

## Livré

- Identité bleu nuit, orange, blanc et gris clair, typographie sans empattement et composants cohérents.
- Header marchand : logo, recherche par catégorie, compte/favoris explicitement non disponibles, panier avec compteur ; annonces centralisées et navigation des rayons.
- Accueil : campagne principale, campagnes beauté/numérique, catégories illustrées, nouveautés et sélection éditoriale, bannières tech/mode, SHENA Digital, quatre rayons compacts, produits sur commande et informations pratiques.
- Cartes : visuels studio, prix HTG lisibles, disponibilité de démonstration, badges numériques/sur commande, formats et bouton d’ajout au panier.
- SHENA Digital : identité violette, deux couvertures graphiques et six entrées thématiques. Le catalogue indique ses deux exemples disponibles ; les autres recherches affichent honnêtement un état vide.
- Fiches : galerie standard/rapprochée, informations organisées, prix et actions visibles. Catalogue, filtres, panier et documents harmonisés.
- Responsive : sélections défilantes sur mobile, rayons regroupés pour éviter de grandes zones vides avec huit références.

## Fichiers principaux

`src/app/page.tsx`, `src/app/numerique/page.tsx`, `src/app/globals.css`, `src/components/header.tsx`, `product-card.tsx`, `product-visual.tsx`, `product-gallery.tsx`, `product-rail.tsx`, `quick-add.tsx`, `src/lib/storefront.ts` et `public/products/studio-collection.png`. Fiches, panier, layout, favicon et tests navigateur adaptés. Aucun ajout de dépendance.

Les visuels physiques sont générés, stockés localement et servis via Next Image ; ce ne sont pas des photographies des marchandises réellement disponibles. Les couvertures sont composées en HTML/CSS. Aucun avis, note, réduction ou classement fondé sur des ventes n’est inventé. Les stocks et prix restent fictifs. La barre d’annonce se configure dans src/lib/storefront.ts.

## Validation réellement exécutée

- `npm run format` et contrôle de format : sources homogènes.
- `npm run lint` : réussi.
- `npm run typecheck` : réussi, génération des types Next puis TypeScript strict.
- `npm test` : **9 tests unitaires réussis**.
- `npm run build` : **réussi**, Webpack, génération des 22 pages/artefacts statiques et routes dynamiques.
- `CI=1 npm run test:e2e` : **7 scénarios Chromium réussis**, sur le serveur de production lancé par le runner.

Parcours : recherche, filtres et fiche ; panier mixte/quantités/persistance/suppression ; numérique et routes indisponibles ; clavier et débordement à 320/390/768 px ; captures bureau ; sélecteur de catégories et ajout direct depuis une carte ; galerie, chargement du visuel et liens internes présents sur l’accueil, le catalogue, SHENA Digital et une fiche numérique. Les liens collectés ont renvoyé HTTP 200.

Captures examinées : accueil bureau 1440 px et mobile 390 px, SHENA Digital bureau, fiche produit bureau, dans `test-results/` (ignoré par Git). Les deux premiers tests de navigation ont révélé une zone cliquable insuffisante sur les titres de cartes ; leur lien occupe maintenant toute la zone du titre, et les sept tests passent après correction.

Limites : pas d’audit WCAG complet, Safari/Firefox ou Lighthouse. Les tests ne valident pas de compte, administration, paiement ni téléchargement réel puisque ces fonctions restent absentes. Les tests et serveurs utilisent les permissions nécessaires aux ports locaux ; le premier lancement unitaire sous le sandbox restreint échouait avant d’exécuter les tests.

## Données, revue et déploiement

La configuration Supabase et les variables d’exemple sont inchangées ; aucune requête, migration, suppression ou modification de table n’a eu lieu. Les identifiants produits, prix et quantités de démonstration sont conservés ; seul le nom d’affichage SHENA Studio devient SHENA Digital.

Branche dédiée : `feat/shena-marketplace-redesign`, basée sur `feat/shena-storefront` (branche distante disponible). Le descriptif de PR se trouve dans `docs/pull-request-redesign.md`. Aucune fusion automatique ni commande de déploiement n’est effectuée. Une éventuelle Preview automatique appartient à la configuration Vercel du dépôt et n’a pas été vérifiée ici.
