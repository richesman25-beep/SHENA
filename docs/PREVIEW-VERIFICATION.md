# Vérification Vercel Preview

Projet de référence : shena-2go5. Branche : feat/shena-admin-finalisation. Vérification effectuée le 2 novembre 2026 via l'API Vercel authentifiée, sans afficher ni enregistrer de clé dans Git.

Les variables suivantes ont été configurées et relues dans la portée **Preview + cette branche uniquement** :

- NEXT_PUBLIC_SUPABASE_URL : origine SHENA-STAGING confirmée jusqu'ici.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : identique à la valeur STAGING du gestionnaire sécurisé, sans exposition dans ce document.
- SHENA_DEPLOYMENT_TARGET : staging.
- SHENA_STAGING_PROJECT_REF : prqmomjtmyhqijysfoog.
- SHENA_CHECKOUT_MODE : disabled.
- SHENA_CATALOG_MODE : live.
- SHENA_SITE_URL : origine HTTPS du domaine Preview de branche.

La comparaison des métadonnées Vercel confirme les variables Production inchangées après l'opération. Le redéploiement dpl_BTzdnTsXAwfWaNeo9BLFEGYxDhet, commit 3549d7e, est READY, cible staging (nom API Vercel pour Preview), sans erreur de build. Le domaine de branche est bien affecté à ce déploiement.

## Limites constatées

Le domaine prqmomjtmyhqijysfoog.supabase.co renvoie NXDOMAIN depuis l'environnement et via un résolveur DNS public. La connexion STAGING n'est donc pas validée ; aucune conclusion sur ses tables, ses politiques ou la validité de sa clé n'en découle. Le script de contrôle distingue désormais cet échec réseau d'une table réellement absente. Aucune valeur de configuration alternative n'a été inventée.

La Preview redirige les visiteurs non authentifiés vers Vercel. Sa protection SSO reste activée. Le CLI officiel créerait un jeton de contournement d'automatisation au niveau du projet pour tester ce site ; aucun jeton de ce type n'a été généré et aucune protection n'a été désactivée.

Les 20 parcours admin locaux, y compris RPC absentes et refus d'une Server Action déjà ouverte, avaient réussi ; les deux CI du commit 3549d7e sont réussies. Cela ne constitue pas un test HTTP authentifié de la Preview ni une recette Supabase distante.

Aucune migration, donnée Supabase Production, variable Vercel Production ou fusion GitHub n'a été effectuée. Commandes et paiements réels restent désactivés. Avant publication de main : résoudre la cible STAGING, terminer les tests de Preview authentifiés et examiner la PR ; toute future correction SQL Production exige toujours script persistant validé et sauvegarde restaurable vérifiée.
