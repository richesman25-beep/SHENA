# Propositions SQL — aucune exécution automatique

Tous les scripts de modification se terminent par ROLLBACK. Aucun n’a été exécuté ici. Le préflight est une lecture seule, à effectuer par un opérateur autorisé et à examiner sans divulguer de données personnelles.

Avant **toute** modification de production : obtenir l’accord explicite sur les fichiers adaptés au schéma réel, une sauvegarde récente de la base et des objets Storage, puis restaurer cette sauvegarde dans un projet isolé. Vérifier comptes/roles/politiques, nombres de produits, prix, stocks, catégories, objets, visibilité des buckets et quelques fichiers restaurés. Un export SQL seul ne sauvegarde pas les octets Storage. Conserver un inventaire et des empreintes, et documenter le résultat du test de restauration.

| Ordre    | Fichier dans docs/proposals            | Préconditions / objet                                                                                     |
| -------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 0        | production-00-preflight.sql            | Lecture du schéma, RLS, privilèges, fonctions et buckets existants                                        |
| 1        | production-01-admin.sql                | products avec RLS, revue des politiques écriture existantes ; helper rôle et capacités v1                 |
| 2        | production-02-categories.sql           | Tables absentes ou adaptation manuelle après comparaison ; catégories et associations                     |
| 3        | production-03-storage.sql              | Réutilise product-images public ; nouveaux buckets privés uniquement si absents ; quarantaine PDF         |
| 4        | production-04-managed-media.sql        | Tables/fonctions nouvelles sans conflit ; registre, galerie, audit et réservations                        |
| 5        | production-05-digital-capabilities.sql | Métadonnées numériques et manifeste v2 ; suppression et uploads étendus toujours verrouillés              |
| distinct | geographic-inventory.sql               | Revue spécifique des emplacements, inventaires et reprise des stocks existants, sans déduction fictive    |
| futur    | production-06-future-orders.sql        | Architecture verrouillée, aucune permission client ni paiement activé ; ne pas appliquer dans cette phase |

Les scripts 01–03 préexistants ne sont pas des migrations universelles/idempotentes : leurs CREATE échouent volontairement sur les conflits. Si le projet a déjà un helper, une table, un bucket ou une politique, comparer et produire une adaptation approuvée ; ne pas les supprimer pour faire passer le script. Ne pas remplacer ROLLBACK par COMMIT sans revue et autorisation. Aucune table products n’est réinitialisée et aucune donnée de commerce n’est injectée.

## Vérifications de staging requises

- Anonyme : actifs seulement, aucun produit inactif, écriture refusée.
- Authentifié non-admin : ni accès admin ni privilège obtenu par user_metadata ; RPC/écritures/Storage refusés.
- Chacun des deux administrateurs : lecture des inactifs, création avec types autorisés par les contraintes réelles, édition/concurrence, désactivation, catégories, upload WebP, quarantaine privée.
- Refus de suppression d’une image utilisée, y compris produit inactif ; ancien média non enregistré non supprimable. La suppression reste verrouillée jusqu’à un audit complémentaire.
- Fichier numérique inaccessible sans autorisation, aucun lien client généré, anciennes images inchangées.
- Examiner toutes les politiques permissives, triggers et privilèges existants : les politiques additives ne corrigent pas une ancienne politique trop large.

## Retour arrière et incidents

Avant déploiement, conserver le SHA précédemment publié et les résultats du préflight. En cas de régression, revenir au déploiement applicatif précédent ; laisser les nouvelles tables et objets intacts, verrouiller les capacités/écritures via une intervention opérateur revue. Ne pas DROP les tables ni effacer les données créées entre-temps. Une restauration de production peut perdre des écritures récentes et demande une décision explicite, un rapprochement et un plan d’arrêt/reprise.

Si un upload réussit mais son association échoue, conserver l’objet et rapprocher l’inventaire ; ne pas supprimer automatiquement une ancienne image. Une suppression réservée dont la finalisation est ambiguë reste en état deleting : vérifier Storage et toutes les références avant toute réparation manuelle. Les propositions d’audit conservent les opérations médias/catégories ; une journalisation exhaustive externe et la rétention doivent être validées avant activation des transactions.
