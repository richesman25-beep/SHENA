# Plan de revue et sauvegarde avant toute écriture de schéma

**Aucun des SQL de cette mission n'a été exécuté.** Ils sont hors des migrations automatiques et se terminent par ROLLBACK. Les commentaires et le ROLLBACK ne remplacent pas une autorisation. Une copie d'exécution ne devra être créée qu'après accord explicite ; ne pas lancer tous les brouillons historiques ensemble.

## 0. Préserver et vérifier

Avant toute application réelle : obtenir un inventaire en lecture seule du schéma, contraintes, privilèges, politiques RLS, buckets et versions PostgreSQL ; vérifier l'accès de restauration. Planifier une fenêtre cohérente de capture sans écritures concurrentes, ou une stratégie de snapshot cohérente documentée.

Effectuer une sauvegarde avec les outils Supabase/PostgreSQL appropriés et des identifiants conservés dans un gestionnaire sécurisé (jamais NEXT_PUBLIC ni GitHub). Conserver schéma, données, politiques, fonctions, rôles/privilèges nécessaires et le manifeste des objets Storage. Les fichiers Storage ne sont pas nécessairement couverts par une sauvegarde PostgreSQL : leur sauvegarde doit être traitée séparément.

Vérifier tailles et empreintes des artefacts, lisibilité du dump et inventaire, puis **restaurer dans un projet isolé autorisé** et comparer tables, lignes, contraintes, politiques, fonctions et fichiers échantillons. Une commande dump réussie ou une liste pg_restore seule ne constitue pas une sauvegarde restaurée vérifiée. Consigner identifiant/date de sauvegarde, emplacement protégé, résultat des comparaisons et procédure de retour arrière. Aucun de ces contrôles n'a pu être effectué ici, faute de configuration ; ils restent une condition avant migration.

## Propositions indépendantes à examiner

1. `production-01-admin.sql` : helper d'autorisation relisant auth.users.app_metadata, politiques select/insert/update des administrateurs sur products, fonctions de capacités. La lecture publique existante des actifs n'est pas supprimée. Aucune colonne products n'est inventée ou ajoutée. Le brouillon refuse les politiques d'écriture existantes non examinées. Aucun compte admin n'est créé.
2. `production-02-categories.sql` : categories et association product_categories, contraintes, index, RLS publique limitée aux catégories et produits actifs et écritures admin. Aucun classement automatique d'anciens produits.
3. `production-03-storage.sql` : bucket d'images public uniquement WebP, quarantaine privée PDF, futur bucket de ressources payantes privé, digital_assets privé et politiques admin. Aucune conversion d'un bucket existant en public ; un conflit de nom impose examen. Les fichiers ne sont jamais livrés aux clients dans cette phase. Analyse, validation de licence, publication et droits d'achat sont encore à construire.
4. Géographie : le brouillon historique `geographic-inventory.sql` et son plan expliquent departments, communes, points, inventories, zones/méthodes/tarifs et shipments/tracking. **Ne pas l'appliquer tel quel avec le modèle de rôles de cette mission** : il faudra substituer shena_is_admin au modèle historique logistics_admins après revue, vérifier les conflits et valider une version cohérente unique. Les commandes n'existent pas encore ; ne pas créer leur FK par supposition.

## Compatibilité du stock

Conserver products.stock en mode legacy jusqu'à répartition physique vérifiée. Ne jamais attribuer les stocks réels aux villes des fixtures, ne pas mettre à zéro les produits dont les inventaires ne sont pas repris. Le passage vers le mode géographique doit être par produit, réconcilié et réversible. Une procédure transactionnelle approuvée doit devenir l'unique autorité d'écriture, maintenir l'agrégat (quantités vendables) et gérer verrous, réservations et expiration. Cette procédure n'est pas activée par la présente mission.

## Ordre de validation

Examiner les propositions, confirmer la sauvegarde restaurée, demander l'accord sur chaque lot, tester les politiques dans le projet isolé puis appliquer uniquement le lot explicitement approuvé. Vérifier après chaque étape : anonymes, deux clients distincts, admin, rôle révoqué, produits actifs/inactifs, mises à jour de prix/stock, refus de suppression, images MIME/SVG/taille/pixels, confidentialité des ressources et absence de lien signé payant. Les fonctions de capacités doivent annoncer uniquement les éléments réellement installés. Ne pas modifier expected checksums, désactiver TLS ou RLS pour contourner un échec.

Les formats structurés/licences, droits d'accès numériques et livraison après paiement nécessitent des propositions additionnelles et une phase validée, pas un paiement ou une commande simulés dans l'administration actuelle.
