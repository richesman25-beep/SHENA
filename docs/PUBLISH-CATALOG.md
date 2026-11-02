# Publication Production — catalogue SHENA

La PR #3 reste l'unique PR d'intégration vers main. Aucune fusion automatique ni migration de base n'est autorisée.

## Version publiable sans migration

- Catalogue Supabase réel, produits et images conservés ; recherche, filtres, panier local et devis serveur réutilisés.
- Projet Vercel de référence : shena-2go5 ; branche Production : main.
- Variables publiques Supabase et SHENA_SITE_URL existantes préservées. Drapeaux Production explicitement préparés : SHENA_CATALOG_MODE=live et SHENA_CHECKOUT_MODE=disabled.
- Commandes Production, paiements et téléchargements payants désactivés. L'administration refuse les écritures si les capacités SQL nécessaires ne sont pas installées.
- Aucun passage par SHENA-STAGING n'est requis pour publier le catalogue. Les anciens documents de recette STAGING restent des archives techniques, pas des étapes demandées au propriétaire.

Le contrôle public réel de Production a retourné HTTP 200 sur les produits actifs et HTTP 206 sur une image existante. Aucune donnée n'a été modifiée. `npm run check:deployment -- production` vérifie aussi la cohérence de configuration sans réseau.

## SQL préparé, non exécuté

1. `docs/proposals/production-00-products-acl-revoke-reviewed.sql` retire les sept privilèges dangereux, dont TRUNCATE, et conserve SELECT/RLS. Les droits hérités et les métadonnées inattendues font arrêter le script.
2. `docs/proposals/production-01-admin-production-candidate.sql` adapte le contexte opératoire de la migration admin déjà revue au projet Production connu. Les types et la politique correspondent aux métadonnées fournies ; les données historiques et le propriétaire restent à vérifier. Aucun compte ni donnée n'est corrigé automatiquement.

Les deux fichiers restent des propositions avec ROLLBACK final, pas des installations persistantes. Les gardes de session ne prouvent ni l'identité du projet ni une restauration. Avant toute modification réelle de la base : sauvegarde restaurée/vérifiée, revue d'un script persistant et approbation explicite distincte. Le privilège TRUNCATE rapporté reste ouvert jusque-là ; la publication du code ne le révoque pas.

## Dernière validation de publication

Préparer le build Vercel Production avec `--prod --skip-domain` pour garder les domaines publics sur le déploiement actuel. Après accord du propriétaire : intégrer la PR vers main, vérifier le build correspondant, puis publier/promouvoir la version approuvée. Ne pas modifier la base dans cette opération.

Retour arrière du code : rétablir le précédent déploiement Vercel validé, sans changement SQL. La correction des ACL et l'activation de l'administration sont une opération distincte ; elles ne doivent pas bloquer le catalogue seul.
