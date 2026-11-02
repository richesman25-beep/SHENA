# Audit SHENA Admin — 2 novembre 2026

## Référence et préservation

Branche `feat/shena-admin-finalisation` créée depuis `origin/main` (`135d03a`). La branche `feat/shena-supabase-admin` (`3f49208`) est déjà incluse dans cet historique. La différence avec main ne porte que sur README/AGENTS : aucune fusion supplémentaire ni réécriture nécessaire. Un seul dépôt SHENA est conservé. Aucune publication ni fusion automatique.

Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Supabase JS 2.118.0 et SSR 0.12.7 sont installés avec lockfile. Les API Next utilisées ont été comparées aux documents fournis avec cette version.

## Contrôles CI observés

Les exécutions Quality `41364115178` et `41363976885`, sur le dernier main audité, sont réussies. L’ancienne exécution `41363849086`, sur `3f49208`, échouait à `npm run test:e2e`. Les journaux détaillés sont hébergés sur un domaine d’artefacts inaccessible depuis cet environnement ; aucune cause précise n’est affirmée sans ces journaux. Les validations de cette branche sont décrites séparément dans VALIDATION.md.

## État initial et changements

| Fonction                       | État initial                                              | Cette branche                                                                                                 |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Catalogue public               | Lecture Supabase réelle des actifs, erreurs sans fallback | Conservé, aucune reconstruction publique                                                                      |
| Refonte / Digital / géographie | Interface existante, géographie réelle non raccordée      | Conservés ; aucun stock local fictif utilisé en live                                                          |
| Admin                          | Routes françaises, contrôle Auth serveur + capacités RPC  | Navigation responsive, routes `/admin/products`, alias historiques                                            |
| Produits                       | Création/modification simple, désactivation               | Recherche/filtres/pagination, aperçu privé, confirmation, contrôle des modifications concurrentes et doublons |
| Dashboard                      | Présentation des fonctions à venir                        | Compteurs des lignes réellement autorisées, produits créés récemment, aucune vente inventée                   |
| Auth                           | Connexion/déconnexion                                     | Récupération et changement de mot de passe, origine de redirection fixe                                       |
| Images                         | Validation/réencodage serveur + Storage                   | Aperçu local, explorateur, image principale/registre conditionnés aux permissions                             |
| Digital                        | PDF en quarantaine privée                                 | Métadonnées structurées conditionnelles ; paiement/livraison toujours inactifs                                |
| Commandes/clients/paiements    | Démonstration publique                                    | Pages admin explicitement non actives, contrats/SQL futurs sans API de transaction                            |

## Schéma et sécurité

Toutes les requêtes products utilisent uniquement les neuf colonnes confirmées : id, created_at, name, description, price_htg, product_type, stock, image_url, active. HTG est la devise de price_htg, pas une nouvelle colonne. Les catégories sont des associations séparées. Sans RPC de capacités approuvée, les écritures sont verrouillées même pour un utilisateur dont le rôle est valide.

Chaque opération serveur appelle `requireAdmin`, qui utilise `getUser`, contrôle strictement `app_metadata.shena_role`, puis les capacités. `user_metadata` ne donne aucun privilège. Les propositions RLS relisent le rôle dans auth.users, avec search_path fixe et EXECUTE limité. Aucune clé service dans l’application, aucun compte privilégié intégré. Archive signifie active=false : aucune suppression définitive de produit.

Les images sont décodées/réencodées avec sharp, taille maximale 2 Mo et nom aléatoire sans écrasement. Les fichiers payants ne sont jamais exposés dans l’explorateur public. Le manifeste proposé conserve `mediaDelete=false` : sa levée exige un audit réel des références et de toutes les politiques Storage combinées. Les fichiers autres que PDF restent aussi refusés par le manifeste livré.

## Limites de vérification réelle

Le propriétaire rapporte une connexion Supabase déjà vérifiée sur Vercel par modification d’un produit. Les deux variables publiques sont présentes dans l’environnement Codex, sans valeur affichée dans les livrables. Le réseau actif ne permet pas actuellement l’hôte Supabase du projet. Un brouillon réseau ajoutant cet hôte exact a été préparé, sans publication. Aucun compte fondateur ni politique distante n’a donc été validé ici ; aucune écriture, migration, suppression ou demande d’e-mail sur la production n’a été exécutée.

Les noms et contraintes des nouvelles structures restent des propositions à comparer au préflight réel. Les capacités ne constituent pas un audit automatique complet de toutes les politiques : PostgreSQL combine les politiques permissives avec OR ; une ancienne politique trop large doit être identifiée et corrigée dans une modification explicitement approuvée.
