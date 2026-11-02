# Préparer le catalogue Supabase existant et une administration serveur protégée

La version premium utilisait exclusivement des fixtures et ne disposait d'aucune authentification ni écriture réelle. Cette modification conserve son interface, SHENA Digital et la localisation, mais fait du mode live la valeur par défaut : sans configuration ou en cas d'échec de lecture, le catalogue reste vide avec un état explicite, sans remplacement par les exemples. Le mode demo reste disponible volontairement pour les tests/revues.

Le catalogue interroge les seules colonnes existantes de products sous active=true, utilise les UUID pour les fiches et conserve recherche/filtres/panier local. Les catégories et stocks géographiques ne sont pas déduits des noms ; les emplacements réels restent à connecter après schéma approuvé.

/admin utilise Supabase SSR, sessions serveur et getUser. Le rôle applicatif de confiance est vérifié sur chaque action. Les écritures exigent un RPC de capacités installé avec les politiques proposées et utilisent le JWT utilisateur soumis à RLS, jamais une clé service. Les écrans préparent liste/création/modification/activation/prix/stock, catégories et images réencodées WebP. Les PDF ne peuvent aller qu'en quarantaine privée ; aucun téléchargement client ni paiement n'est activé.

Les deux variables Supabase sont absentes de l'instance : leur configuration et la validation réelle restent à effectuer par le propriétaire. Les propositions SQL sont séparées et non exécutées ; une sauvegarde restaurée et vérifiée puis une approbation explicite sont requises avant toute application. Aucune donnée, table ou politique n'a été supprimée ou réinitialisée.

Validation et limites réelles : docs/production-validation.md. Audit et configuration : docs/production-audit.md et docs/production-setup.md. Base de revue : feat/shena-premium-local-commerce. Pas de fusion ni de déploiement automatique demandé.
