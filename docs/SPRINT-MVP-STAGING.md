# SHENA — MVP préparé pour validation STAGING

Travail centralisé dans le même dépôt et la PR #3, sans fusion ni modification de Production. Catalogue Supabase, interface premium, SHENA Digital et sélection géographique conservés. Les données de démonstration ne remplacent pas un échec du catalogue réel.

## Fonctionnalités développées

- Administration authentifiée côté serveur : création, édition, publication, prix/stock, contrôle de révision, upload d'images validées/réencodées et PDF en quarantaine. Le rôle est lu dans app_metadata vérifiées ; user_metadata ne donne aucun accès.
- Panier existant réutilisé ; quantités, devis recalculé côté serveur, destination et tarif issus des zones autorisées. Les prix/flags de paiement envoyés par le navigateur ne sont jamais une autorité.
- Commande de test authentifiée : montants recalculés en base, stock réservé, clé d'idempotence, numéro et statuts ; consultation privée et suivi administrateur.
- Zones de livraison configurables sans tarif inventé. Stock global réservé ; les stocks par emplacement restent une proposition distincte non activée. Les réservations expirées demandent encore une annulation administrative pour libérer le stock ; aucune tâche automatique n’est activée.
- Revue manuelle de paiement avec référence, montant exact, journal et deux admins distincts encore autorisés. Aucun appel MonCash/NatCash/cartes inventé ; aucune livraison numérique payante.

Ces fonctions sont testées localement et **ne sont pas installées sur Supabase**. Commandes et revue de paiement sont limitées au projet STAGING confirmé, avec drapeaux en base initialement faux. Aucun bouton ni paramètre d'URL ne suffit à déclarer un paiement vérifié. Les fichiers numériques restent privés sans délivrance client.

## Sécurité prioritaire products

Le bootstrap fidèle reprend les dix colonnes confirmées, PK et politique SELECT, avec RLS avant accès client. Il conserve la nullabilité historique ; la migration admin ajoute ensuite ses propres contraintes, qui peuvent refuser les anciennes données invalides sans les modifier.

Le correctif minimal retire INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER et MAINTAIN à anon/authenticated. Il conserve SELECT et la politique publique. Les tests pré-admin et post-admin sont distincts : après migration admin, authenticated reçoit les droits de colonnes nécessaires, tandis que RLS refuse les clients ordinaires. TRUNCATE et DELETE restent interdits aux comptes applicatifs.

**Production reste exposée aux privilèges excessifs rapportés tant qu'un correctif persistant approuvé n'y est pas appliqué.** RLS ne protège pas TRUNCATE. L'existence d'une route exploitable n'a pas été démontrée ; aucune tentative n'est faite en Production.

Fichiers à examiner, dans cet ordre :

1. `docs/proposals/production-00-products-acl-inventory.sql` : inventaire en lecture seule, y compris droits effectifs/hérités, schémas et fonctions.
2. `docs/proposals/staging/00-products-bootstrap-review.sql` : reproduction sur STAGING vide avec fixture fictive inactive.
3. `docs/proposals/production-00-products-acl-revoke-reviewed.sql` et `tests/products-acl-staging.sql` : correction et refus avant administration.
4. `docs/proposals/production-01-admin-reviewed.sql` et `tests/admin-products-staging.sql` : rôle serveur, grants de colonnes, politiques et cas client/deux admins.
5. `docs/proposals/staging/02-storage-review.sql` puis `04-storage-capabilities-review.sql` : buckets et capacités contrôlées. product-images public pour les images commerciales, digital-quarantine/digital-products privés.
6. `docs/proposals/staging/03-commerce-review.sql` : tables/RPC de commande et revue manuelle, initialement désactivées. Aucun tarif ni délai commercial n'est choisi automatiquement.

Tous les fichiers de migration de revue se terminent par ROLLBACK. Aucun n'est exécuté au build. Une installation persistante demande un artefact et un accord séparés ; ne pas remplacer ROLLBACK par COMMIT.

## Tests et limites

Résultats : TypeScript, lint, formatage et build réussis ; 73 tests locaux réussis et 1 ignoré volontairement ; 14 contrôles SQL statiques ; 13 parcours publics démo, 3 sans configuration et 19 admin/commandes réussis. Détails : [admin/VALIDATION.md](admin/VALIDATION.md). Les modèles PostgreSQL en mémoire et les parcours navigateur isolés ne prouvent pas le fonctionnement du projet Supabase distant, de son Auth, de son SMTP ou de son Storage. Le correctif ACL final est contrôlé statiquement ; son exécution est réservée à SHENA-STAGING. Aucune sauvegarde restaurée et vérifiée n'est annoncée.

## Configuration manuelle indispensable

Dans **Vercel Preview uniquement**, définir :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://prqmomjtmyhqijysfoog.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clé publique du projet STAGING>
SHENA_DEPLOYMENT_TARGET=staging
SHENA_STAGING_PROJECT_REF=prqmomjtmyhqijysfoog
SHENA_CHECKOUT_MODE=disabled
SHENA_CATALOG_MODE=live
SHENA_SITE_URL=<origine HTTPS de la Preview vérifiée>
```

Aucune clé secrète/service_role dans le navigateur. Une Preview mal configurée est bloquée par le code ; cela ne modifie pas les réglages Vercel ni les anciennes Previews déjà publiées. Vérifier leur protection, configurer les redirections Auth STAGING puis reconstruire la Preview. Ne pas modifier les variables Vercel Production.

Dans le gestionnaire sécurisé **Codex**, renseigner `SHENA_STAGING_SUPABASE_URL`, `SHENA_STAGING_SUPABASE_PUBLISHABLE_KEY`, `SHENA_STAGING_PROJECT_REF` et autoriser le domaine STAGING. Le brouillon d'environnement doit être revu/publié par l'opérateur ; la configuration active ne dispose pas encore de ces accès. `npm run check:staging` n'utilise aucun repli vers les variables Production. Ne transmettre aucun mot de passe ou secret dans le chat.

Après revue SQL et accord, préparer trois comptes STAGING vérifiés : client et deux admins. Les éventuelles variables de test Auth sont listées dans `.env.example` et restent dans le gestionnaire sécurisé. La durée de réservation et les frais/zones doivent être décidés par le propriétaire. N'activer `SHENA_CHECKOUT_MODE=staging` et les drapeaux correspondants qu'après recette autorisée.

## Approbations et retour arrière

Sont en attente : exécution de la recette transactionnelle STAGING, éventuelle simulation isolée des grants excessifs, installation persistante STAGING, création/attribution des comptes admin et configuration Vercel. Aucun rôle système ni appartenance n'est changé.

Avant toute opération Production : inventaire actualisé, sauvegarde et restauration isolée vérifiées (y compris plan Storage), résultats STAGING, script persistant revu et approbation explicite. Les scripts de revue annulent leurs effets par ROLLBACK. Ne jamais restaurer aveuglément les grants dangereux ; le candidat de rollback ACL est commenté et bloqué. Pour le code, revenir à une révision validée n'annule pas une migration SQL. Conserver les transactions réelles et les téléchargements payants désactivés jusqu'à validation.
