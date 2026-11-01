# Architecture et phases

## Périmètre actuel

Phase 1 : Next.js App Router, TypeScript strict, Tailwind, composants communs, identité et navigation. Éléments de phase 2 : accueil, catalogue responsive, recherche/filtres/tri/pagination et fiches. Éléments de phase 3 : catalogue numérique, métadonnées de format/licence, aperçus illustrés ; la bibliothèque et la livraison de fichiers sont uniquement décrites. Panier local préparatoire. Configuration Supabase préparée sans connexion.

Les catégories sont centralisées ; les produits utilisent un contrat métier indépendant de la future représentation SQL. Les montants de démonstration sont des HTG entiers. Le modèle réel devra utiliser des unités monétaires mineures entières côté serveur ou PostgreSQL numeric et une politique explicite d’arrondi. La pertinence de démonstration suit l’ordre éditorial. « Nouveautés » inverse l’ordre des données locales ; aucun historique réel de création n’est revendiqué.

## Phases suivantes — autorisation nécessaire

4. Connexion au projet Supabase existant, lecture des seuls produits actifs et vérification RLS, dont le produit Sneakers SHENA. Auth SSR via cookies sécurisés et validation serveur de l’utilisateur. Conserver la compatibilité avec les colonnes existantes et documenter le mapping des valeurs product_type réelles.
5. Comptes, profils, adresses, checkout et commandes transactionnelles. Recharger prix/stock/variantes depuis PostgreSQL ; verrouiller les lignes de stock et garantir l’idempotence ; prévoir expiration et restitution des réservations. Aucun total du navigateur ne doit être accepté comme référence.
6. Administration : rôle vérifié côté serveur et RLS, audit des opérations sensibles, gestion du catalogue et fichiers. Ne pas accepter un rôle porté uniquement par un champ navigateur.
7. Paiements et numérique : adaptateurs de prestataires autorisés, signature et idempotence des événements serveur, états contrôlés, vérification administrative documentée des paiements manuels. Une capture d’écran seule n’est pas une preuve. Aucune intégration officielle MonCash/NatCash ni disponibilité de Stripe n’est présumée.
8. Validation complète, sécurité, accessibilité, performances et publication après accord.

## Schéma futur proposé — ni SQL appliqué ni tables présumées

Un livrable SQL additif détaillé, à examiner et autoriser séparément, devra couvrir les tables suivantes. Aucun script d’installation ne doit lancer de migration automatiquement.

| Domaine   | Tables envisagées et contraintes                                                                                                                                  | Accès envisagé                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Catalogue | categories (slug unique, parent_id FK), product_categories, product_images (product_id FK, position), variants (product_id FK, SKU unique, stock >= 0, prix >= 0) | Lecture publique des seuls contenus actifs ; écriture admin                   |
| Clients   | profiles (id FK auth.users), addresses (user_id FK)                                                                                                               | Propriétaire uniquement ; accès admin strictement nécessaire                  |
| Panier    | carts, cart_items (cart_id FK, variant_id FK, quantité > 0, unicité ligne)                                                                                        | Propriétaire ; prix recalculés au checkout                                    |
| Commandes | orders (user_id FK, devise, total, statut), order_items (instantanés prix/titre/taxe, quantité), shipments                                                        | Lecture propriétaire, transitions serveur et admin contrôlées                 |
| Paiement  | payments (order_id FK, provider, référence unique, état), payment_events (clé d’idempotence unique), audit_log                                                    | Écriture serveur de confiance, lecture client minimisée                       |
| Numérique | digital_products (product_id FK), digital_files (chemin privé, version, hash, MIME, taille, état analyse), licenses                                               | Métadonnées publiables séparées des chemins privés                            |
| Droits    | entitlements (user_id, order_item_id, expires_at, max_downloads), download_events                                                                                 | Droits issus d’un paiement confirmé ; lecture propriétaire ; création serveur |
| Gestion   | administrators (user_id unique), promotions, business_settings, banners                                                                                           | Admin serveur ; paramètres publics explicitement sélectionnés                 |

Indexer toutes les FKs utilisées, les couples (user_id, created_at) et (status, created_at), ainsi que les filtres actifs du catalogue. Poser des contraintes de montants et de quantités, des uniques d’idempotence et une politique RLS distincte par opération. Révoquer les écritures publiques par défaut, expliciter les privilèges et tester les rôles anon/client A/client B/admin. Tester les ajouts sur une copie de schéma avant toute approbation d’exécution. Préserver la politique de lecture active et chaque ligne de public.products.

## Livraison numérique future

Buckets privés uniquement. Téléversement admin avec allowlist MIME et extension, signature du format, taille maximale, quota et analyse antivirus en quarantaine avant publication ; contrôler ZIP et macros. Plusieurs fichiers versionnés par produit. Un droit est créé de manière idempotente à partir d’une ligne de commande payée. À chaque téléchargement : authentifier côté serveur, vérifier propriétaire, commande, révocation, expiration et limite annoncée, réserver atomiquement l’accès et générer un lien signé de courte durée. Journaliser sans stocker le lien signé. Les limites doivent être affichées avant achat. Aucun lien permanent public ni clé service dans le navigateur.

## Marketplace future

Commencer avec SHENA comme vendeur unique. Une évolution pourra ajouter sellers, stores, product_sellers, seller_order_allocations, commissions et payouts. Séparer orchestration de commande et allocations par vendeur. Ne pas ajouter de seller_id requis aux produits existants sans plan de reprise non destructif. Onboarding vendeurs, litiges et commissions restent hors MVP.
