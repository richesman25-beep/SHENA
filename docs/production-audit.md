# Audit et préparation production — première mission

## Branches et historique observés

Audit Git natif après fetch : branches distantes feat/shena-storefront (364eaf5), feat/shena-marketplace-redesign (28712e0), feat/shena-premium-local-commerce (283552d). Aucune main n'a été observée. La référence origin/HEAD est restée associée à la première branche ; elle ne prouve pas que cette version soit la plus complète.

La branche feat/shena-supabase-admin est créée depuis 283552d, sommet de la version premium, qui contient les deux refontes et l'intégralité des fonctionnalités géographiques/Digital précédentes. Le checkout était propre au départ. Aucun reset, écrasement, squash, rebase, suppression de branche ou fusion n'a été réalisé.

## Ce qui était opérationnel avant cette mission

Interface Next.js responsive, navigation et routes, filtres/recherche/pagination sur des fixtures, panier local, choix manuel de commune et persistance, classement administratif sur stocks fictifs, aperçus numériques, galeries et atelier de stocks en mémoire. Les tests antérieurs validaient ces comportements locaux, pas Supabase.

Aucun accès Supabase n'était instancié. Aucune Auth, route admin authentifiée, écriture produit, image Storage, catégorie persistante, commande, paiement, fichier numérique livré ou droit d'achat n'était opérationnel. La bibliothèque et les livraisons étaient seulement préparées et signalées comme indisponibles.

## Changement de contrat

Le mode par défaut est désormais live. Sans configuration, le catalogue reste vide et explique son indisponibilité ; il ne remplace jamais une erreur Supabase par des produits fictifs. `SHENA_CATALOG_MODE=demo` active explicitement les anciens exemples avec leurs mentions. Les visuels de campagne et aperçus génériques restent des illustrations identifiées ; leurs liens commerciaux mènent aux catégories en mode réel, pas aux anciennes fiches fictives.

La lecture anonyme de products sélectionne seulement les dix colonnes confirmées et active=true, sans session admin. Les routes des produits réels utilisent leur UUID existant, faute de colonne slug. La recherche et les filtres se conservent sur les données adaptées. Les valeurs de type inconnues sont signalées et leur ajout au panier est désactivé. Prix invalides ou stock négatif sont exclus, pas corrigés silencieusement.

La table existante ne contenant ni catégorie ni marque ni emplacements, ces informations ne sont pas déduites des noms. Les physiques apparaissent dans Autres produits tant que leurs catégories ne sont pas reliées après un schéma approuvé. Le numérique est identifié à partir des valeurs reconnues de product_type. Un RPC de capacités optionnel évite de supposer l'existence des nouvelles tables ; son absence n'empêche pas la lecture des produits existants.

Le panier réel reste un panier local sans commande ni réservation. Il utilise les produits chargés, exclut les identifiants des fixtures et recalcule les montants depuis le catalogue fourni. Les montants décimaux en HTG sont affichés jusqu'à deux décimales. Les données de paniers démo et live sont séparées. Le prix définitif devra encore être contrôlé côté serveur lors d'une phase de commande ultérieure.

## Authentification et autorisations

/admin et toutes ses sous-routes métier sont gardées côté serveur. L'utilisateur est vérifié auprès de Supabase Auth avec getUser ; seule app_metadata.shena_role=admin est acceptée. user_metadata, un champ de formulaire ou l'URL ne confèrent aucun rôle. Aucun compte ni mot de passe n'est intégré au dépôt.

Les sessions sont en cookies HttpOnly, SameSite=Lax et Secure en production. Le proxy rafraîchit la session ; il n'est pas la frontière d'autorisation. Chaque action de modification réexécute la vérification d'identité/rôle et exige une capacité annoncée par le RPC shena_admin_status. Sans ce RPC et les politiques attendues, les écritures restent verrouillées. Toutes les requêtes utilisent la clé publique avec le JWT utilisateur, jamais un rôle service.

Les propositions SQL relisent les métadonnées applicatives depuis auth.users pour les politiques, afin qu'une révocation ne dépende pas uniquement d'une ancienne revendication JWT. Avant leur application, auditer les politiques existantes : le premier brouillon refuse la présence de politiques d'écriture non examinées au lieu de les supprimer.

## Préparé dans le code, non vérifié sur le projet réel

- Authentification par mot de passe d'un compte réel autorisé, déconnexion et refus des comptes sans rôle.
- Liste des produits visibles sous RLS, création, modification du prix/stock/type et activation/désactivation.
- Téléversement d'images : rôle et capacité, JPEG/PNG/WebP, limite 2 Mo et 16 millions de pixels, décodage et réencodage WebP par sharp, métadonnées supprimées, nom aléatoire et aucun remplacement d'ancien fichier.
- Catégories : créer/modifier/activer et associer un produit après installation approuvée des tables/politiques.
- Numérique : sélection des produits numériques et téléversement PDF limité à 2 Mo en quarantaine privée, sans lien client. Aucun PDF n'est livré avant analyse. Autres formats et publication nécessitent une phase dédiée.

Sans variables et accès disponibles, ni ces opérations authentifiées ni les écritures RLS n'ont pu être validées sur Supabase SHENA. Les tests de contrat utilisent un transport simulé et ne prouvent pas l'état de ses politiques.

## Ce qui reste en préparation/démonstration

Les stocks par commune restent des exemples uniquement en mode demo. En mode live, le filtre proche est conservé mais désactivé jusqu'à connexion de vrais emplacements ; le stock global ne devient jamais un stock à Hinche par supposition. /admin/stocks expose les prérequis et le plan de reprise, sans écriture géographique. L'ancien atelier public reste une simulation explicitement identifiée, pas une administration.

SHENA Digital est conservé. Le schéma actuel ne contient pas de formats, licences structurées ou droits d'achat ; les fiches ne les inventent pas. La bibliothèque reste indisponible. Aucun paiement, commande réelle, livraison transporteur, réservation ou téléchargement payant n'est activé.
