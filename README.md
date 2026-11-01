# SHENA

## Une seule version de référence : main

Le dépôt unique `richesman25-beep/SHENA` rassemble toutes les évolutions sur `main` : interface premium, SHENA Digital, localisation, catalogue Supabase et administration préparée. Les étapes précédentes sont conservées dans l’historique Git, pas dans des projets séparés. Pour la phase actuelle, lire [la configuration production](docs/production-setup.md) et [le rapport de validation](docs/production-validation.md).

Première intervention : fondations et vitrine e-commerce en français, destinée au marché haïtien. Next.js App Router, React, TypeScript strict et Tailwind CSS. Tous les produits, stocks et prix sont **des données de démonstration**, les visuels sont des images studio générées et des couvertures numériques de démonstration.

## Démarrer

Node.js 24 LTS et npm 11 (versions utilisées pour les validations). Depuis la racine du dépôt :

```sh
npm ci
npm run dev
```

Ouvrir le serveur local sur le port 3000. Pour vérifier la version de production :

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

Après installation du navigateur Playwright (`npx playwright install chromium`, et si nécessaire ses dépendances système via l’environnement), exécuter `npm run test:e2e`. Le runner lance le serveur de production si aucun serveur n’écoute déjà sur 3000. Les tests se trouvent dans `tests/`. Les captures sont produites dans `test-results/` et ne sont pas versionnées.

## Fonctionnalités livrées

- Accueil, cinq univers, catalogue paginé, recherche, filtres combinés (catégorie, marque, prix, disponibilité et type), tri.
- Département numérique et huit fiches de démonstration physiques, sur commande et numériques.
- Panier local persistant, quantités bornées par le stock fictif, numérique limité à une unité, suppression et récapitulatif mixte.
- Documents provisoires : livraison/retours, confidentialité, conditions de vente, licences.
- Métadonnées, icône, chargement, erreur et 404, accès clavier et mise en page mobile.

**Pas de commandes, comptes, administration, paiements, réservations de stock ou téléchargements opérationnels.** Les routes correspondantes ne sont pas implémentées et renvoient une 404. Le panier n’est jamais une source fiable pour une commande réelle. Son prix est recalculé depuis le catalogue local pour la démonstration, sans garantie serveur de stock.

## Structure

- `src/app/` : pages App Router et styles ; composants serveur sauf interactions.
- `src/components/` : navigation, cartes, catalogue et interactions panier.
- `src/lib/catalog.ts` : source de démonstration typée, catégories centralisées et filtrage.
- `src/lib/cart.ts` : normalisation des données non fiables et calculs testables.
- `src/lib/supabase/config.ts` : configuration et contrat de la table existante, sans connexion.
- `public/products/` : planche studio générée locale et illustrations historiques ; recadrage et optimisation via ProductVisual / Next Image.
- `docs/` : design, sécurité, schéma futur et déploiement.

## Supabase existant — aucune opération exécutée

Le projet SHENA et `public.products` doivent être conservés. `.env.example` contient uniquement les noms `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Copier vers `.env.local` **uniquement lors de la future phase de connexion autorisée**, puis entrer les valeurs publiques appropriées de ce projet. `.env.local` est ignoré. Aucune clé réelle n’est incluse, aucun client Supabase n’est instancié, aucune requête ni migration n’est exécutée dans cette version. Les dépendances Supabase SSR/JS sont disponibles pour cette future phase.

La future requête doit sélectionner uniquement `id,created_at,name,description,price_htg,product_type,stock,image_url,active`, filtrer `active = true`, et utiliser la clé publique sous RLS, jamais un rôle de service pour le catalogue. La politique existante `Public can view active product` doit rester activée. Après autorisation et connexion, vérifier que `Sneakers SHENA` apparaît si actif. Le produit local portant ce nom est une **démonstration distincte**, pas une preuve de lecture de la base.

Ne pas recréer/réinitialiser la base, désactiver RLS, supprimer des données ou supposer d’autres tables. Toute migration exige une proposition SQL examinable et votre autorisation explicite préalable.

## Suite du développement

Voir `docs/architecture.md` pour le découpage et `docs/deployment.md` pour Vercel. Les phases 4 à 8 ne sont pas exécutées. Avant toute vente : catalogue et photos réels, conditions commerciales validées, tarifs de livraison, checkout transactionnel, autorisations, paiements vérifiés et livraison numérique privée testés. Aucune offre promotionnelle n’est inventée : le bloc d’offres sera activé uniquement avec de vraies conditions commerciales.

## Refonte UI/UX

Identité bleu nuit et orange, header marchand, campagnes et rayons compacts, ajouts au panier depuis les cartes et espace **SHENA Digital**. Voir `docs/design.md` et `docs/redesign.md`. Les données, le panier et le contrat Supabase sont conservés ; aucun accès réel à Supabase n’est activé.

## Version premium et stocks multivilles

L’accueil et le header sont reconstruits avec Manrope locale et la palette bleu/corail. La localisation manuelle et le filtre de proximité utilisent exclusivement des stocks fictifs. Référentiel de démonstration : dix départements et seize communes, couverture partielle explicitement affichée. Aucune intégration Supabase n’est activée.

- `src/lib/geography.ts` : départements/communes et validation du choix.
- `src/lib/logistics.ts` : inventaires fictifs, classement géographique, livraison non configurée et simulation d’origines.
- `/gestion-stocks-demo` : atelier public de stocks, en mémoire uniquement ; aucune administration réelle.
- `/mes-achats-numeriques` : information sur la future bibliothèque, sans achat simulé.
- `docs/geography.md`, `docs/premium-design.md` : contrats, sources et limites.
- `docs/proposals/` : schéma SQL et reprise du stock, uniquement à examiner avant toute autorisation d’exécution.

La préférence locale `shena.location.v1` peut être modifiée ou effacée via le sélecteur. Les produits numériques restent sans frais ni transport physique. Sans règle validée : « Livraison et tarif à confirmer ».

## Préparation production : Supabase et administration

**Le mode par défaut est maintenant `live`.** Sans les deux variables publiques de `.env.example`, le catalogue explique sa configuration manquante et n'affiche aucun exemple comme produit réel. `SHENA_CATALOG_MODE=demo` est un choix explicite de revue/test, avec ses mentions de démonstration. Les tests navigateur de démo démarrent leur propre serveur dans ce mode ; `npm run test:e2e:live` vérifie le mode réel sans configuration. Les deux suites doivent se lancer séparément, sans serveur existant sur le port 3000.

- [Audit des branches et fonctions](docs/production-audit.md).
- [Configuration précise Vercel/Codex et validation en lecture seule](docs/production-setup.md).
- [Propositions SQL et sauvegarde/restauration préalable](docs/proposals/production-rollout.md).

L'administration `/admin` est vérifiée côté serveur, sans compte fictif ni mot de passe intégré. Les formulaires sont préparés mais les écritures restent bloquées tant que les capacités/politiques n'ont pas été approuvées et installées. Aucun service_role n'est utilisé. Les uploads d'images sont décodés et réencodés ; les fichiers numériques restent en quarantaine privée (PDF, 2 Mo maximum pour cette première phase, compatible avec la limite de requête prévue). Aucun téléchargement payant ni commande réelle n'est activé.

Les instructions historiques de démonstration et propositions antérieures restent dans le dépôt pour préserver l'historique ; le plan production ci-dessus fait autorité pour cette nouvelle phase. Ne pas appliquer ensemble les SQL historiques et ceux de cette mission sans consolidation et approbation. Aucune migration ne s'exécute au build ou à l'installation.
