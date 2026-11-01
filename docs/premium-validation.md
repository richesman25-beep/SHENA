# Validation — premium et multiville

## Résultats exécutés

Linux, Node 24.19.0, npm 11.9.0, Chromium système. Dépendances et lockfile inchangés ; Manrope et les nouvelles images sont locales.

- `npm run format:check` : réussi.
- `npm run lint` : réussi.
- `npm run typecheck` : réussi avec génération des types Next et TypeScript strict.
- `npm test` : **20 tests réussis**, dont 11 tests supplémentaires de géographie/logistique.
- `npm run build` : **réussi**, production Webpack et 24 pages/artefacts statiques générés, routes catalogue dynamiques.
- `CI=1 npm run test:e2e` : **12 tests Chromium réussis**, avec serveur de production lancé par Playwright.
- `git diff --check` : réussi.

Les tests unitaires vérifient notamment la cohérence des communes et départements, le refus d'un couple invalide, les priorités de proximité, le filtre local incluant le numérique, le mode national, les tris explicites, les stocks à zéro, les totaux par emplacement et le plan de répartition multiville sans dépassement du stock fictif. Ils vérifient aussi qu'une absence de règle, une règle désactivée ou une mauvaise destination ne produit pas d'option de livraison, et que le numérique ne génère aucun transport.

Les tests navigateur vérifient le sélecteur et sa persistance, l'effacement de la commune après changement de département, les modes local/national, les fiches et origines de stock, l'absence de transport numérique, l'autre image de galerie, la future bibliothèque, et les modifications/réinitialisations de l'atelier de stock. Ils conservent les parcours précédents de recherche, filtres, liens internes, ajout au panier depuis les cartes et fiches, quantités, panier mixte, rechargement et suppression.

Le responsive sans débordement est contrôlé à 320, 390 et 768 px sur accueil, catalogue, numérique, fiches physique/numérique, panier, bibliothèque et atelier. Le parcours clavier vérifie le lien d'évitement ; le dialogue se ferme avec Escape et rend le focus au déclencheur. Ce n'est pas un audit WCAG complet.

## Captures examinées

Dans `test-results/`, ignoré par Git :

- `shena-desktop.png` : accueil à 1440 px.
- `shena-mobile.png` : accueil à 390 px.
- `shena-digital-desktop.png` : SHENA Digital.
- `shena-product-desktop.png` : fiche physique.
- `shena-location-mobile.png` : choix du Nord / Cap-Haïtien.
- `shena-catalogue-hinche.png` : résultat du filtre proche à Hinche.
- `shena-stocks-demo.png` : atelier avec un point fictif en rupture.

## Corrections issues des tests

Le premier passage navigateur a révélé que le bouton de localisation dans le formulaire catalogue soumettait ce formulaire et que les labels de sélection étaient ambigus. Le déclencheur est maintenant de type button, le dialogue est rendu dans un portail hors des formulaires, et ses contrôles portent des noms accessibles explicites. Les douze scénarios ont ensuite réussi. La lisibilité des actions corail a été renforcée par du texte sombre.

## Limites et opérations non réalisées

Aucun appel Supabase, changement de table, migration, suppression, désactivation RLS ou secret ajouté. Le schéma SQL est uniquement proposé dans docs/proposals/ et n'a pas été exécuté ni testé contre le projet existant. Le référentiel manuel contient dix départements et seize communes, pas toutes les communes d'Haïti ; sa reprise depuis une source officielle reste à valider. Les stocks, lieux et visuels sont de démonstration. Les tarifs et modes de livraison ne sont pas configurés.

L'atelier est une simulation publique en mémoire et ne prouve pas l'existence d'une administration authentifiée. Pas de paiement, de colis créé, de réservation de stock, de suivi transporteur, de téléchargement privé ou de bibliothèque client opérationnelle. Le choix de localisation est une préférence locale ; aucun GPS n'est demandé. Aucune validation Firefox/Safari, mesure Lighthouse, certification légale ou nouvelle restauration cloud n'est revendiquée. Aucune fusion ni commande de déploiement n'a été effectuée.

Base de revue : `feat/shena-marketplace-redesign`. Branche de cette intervention : `feat/shena-premium-local-commerce`. Le statut effectif de la PR est à distinguer de son descriptif préparé dans docs/pull-request-premium.md.

Branche publiée avec succès. La tentative effective `gh pr create --draft --base feat/shena-marketplace-redesign --head feat/shena-premium-local-commerce` a été refusée par le proxy sur `https://api.github.com/graphql` (Forbidden). Aucune PR n'a donc été créée automatiquement ; la comparaison et le descriptif sont prêts pour une ouverture depuis GitHub. Aucun jeton supplémentaire n'a été demandé.
