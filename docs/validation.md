# Validation de la première intervention

Environnement testé : Linux, Node 24.19.0, npm 11.9.0, Chromium système 154.0.8037.57. Données locales uniquement, aucune requête Supabase ni migration.

- Installation figée `npm ci` : réussie.
- `npm run format:check` : réussi.
- `npm run lint` : réussi, sans avertissement de code.
- `npm run typecheck` : réussi en mode strict.
- `npm test` : 9 tests unitaires réussis : recherche, filtres combinés, tri/pagination, résultat vide, normalisation du stockage non fiable, limites de quantité, panier mixte, unicité des routes et paramètres de recherche répétés.
- `npm run build` : compilation de production Webpack, pages statiques et routes dynamiques.
- `npm run test:e2e` : 5 scénarios Chromium : catalogue et fiches, panier mixte/quantités/persistance/suppression, numérique et 404 admin, clavier/mobile sans débordement, capture bureau et absence d’erreur JavaScript sur l’accueil.
- Captures bureau 1440 px et mobile 390 px examinées ; visuels SVG de démonstration.

## Incidents d’environnement et limites

Turbopack échoue sur l’ouverture de ses ports internes (EPERM), même hors sandbox restreint. Les scripts de développement et de build utilisent donc l’option Webpack officielle de Next.js ; la compilation correspondante a réussi. Le téléchargement du navigateur Playwright a été refusé par la politique réseau. Le navigateur système déjà installé a permis de lancer les tests ; le runner le détecte et permet également un chemin explicite via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Sur CI, le navigateur Playwright est installé explicitement.

Les lectures Git HTTPS réussissent mais le dépôt distant ne présente initialement aucune référence, dont main. L’API GitHub est refusée par le proxy actuel ; api.github.com a été ajouté au brouillon de configuration réseau, sans preuve d’application au runtime. Aucun token supplémentaire n’est demandé. Une PR nécessite une branche de base et un accès GitHub utilisable.

Les tests ne valident pas les comptes, rôles administrateurs, prix/stock transactionnels, paiements ou droits de téléchargement : ces fonctions ne sont pas implémentées. La vérification d’une 404 /admin ne constitue pas un test d’autorisation d’une administration réelle. Aucun audit de sécurité, audit WCAG complet, test Safari/Firefox, mesure Lighthouse ni déploiement réel n’est revendiqué. Le workflow GitHub Actions est fourni mais son exécution distante n’est pas vérifiée.
