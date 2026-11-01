# Préparation Vercel et sécurité

Le dépôt est compatible avec le preset Next.js de Vercel. Racine : celle contenant package.json. Installation : `npm ci`. Build : `npm run build`. Node : 24.x. Aucun compte Vercel n’a été connecté et aucun déploiement n’a été lancé.

Créer d’abord une Preview après revue du code. La démonstration fonctionne sans variables Supabase. N’ajouter les deux variables publiques du projet existant qu’à la phase de connexion autorisée ; une clé secrète ou service_role ne doit jamais porter le préfixe NEXT_PUBLIC ni être committée. Configurer les variables séparément par environnement et ne pas copier les valeurs dans les logs.

Cette version interdit l’indexation par metadata et robots.txt et fournit un sitemap vide afin de ne pas publier des produits fictifs. Avant lancement, remplacer les données, définir les URLs canoniques, ajouter les pages publiques au sitemap, valider Open Graph et seulement alors autoriser l’indexation. SHENA.com est un domaine envisagé, pas un domaine dont la propriété ou la disponibilité est vérifiée.

## Vérifications avant lancement commercial

- Valider les textes juridiques, identité et contacts du vendeur, taxes, livraison, retours et licences.
- Tester RLS pour les produits inactifs, profils, commandes et droits entre plusieurs utilisateurs ; vérifier les sessions serveur et les routes admin.
- Ajouter limitation des abus, validation des entrées, audit et stratégie CSP adaptée aux services réellement activés. Des en-têtes de base sont inclus, sans prétendre constituer un audit de sécurité.
- Recalculer prix et stocks côté serveur, tester concurrence, annulation et idempotence ; ne pas réutiliser le calcul local du panier comme validation commerciale.
- Intégrer uniquement un prestataire autorisé avec documentation et compte marchand ; tester signatures, rejouements et remboursements. Ne jamais accepter une affirmation de paiement navigateur.
- Tester refus d’accès aux fichiers sans achat et entre comptes, expiration des liens et révocation, et la stratégie d’analyse des fichiers.
- Prévoir surveillance, alertes, sauvegardes et procédure de restauration du projet existant, sans reset de la base.

Aucune migration, modification de données, intégration marchande, publication, ni fusion de branche ne doit être effectuée sans l’accord requis du propriétaire.
