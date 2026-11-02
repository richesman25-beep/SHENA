# Publication minimale du catalogue SHENA

La PR #3 est l'unique PR finale de ce travail. Aucun compte réel n'est créé, aucune migration Supabase ni fusion automatique n'est exécutée.

1. Vérifier les contrôles de la dernière révision de la PR ; examiner puis fusionner manuellement vers main lorsque validée.
2. Sur le projet Vercel de référence **shena-2go5**, conserver les variables publiques du projet Supabase Production existant, `SHENA_CATALOG_MODE=live` et `SHENA_CHECKOUT_MODE=disabled`. Ne pas définir `SHENA_DEPLOYMENT_TARGET=staging` en Production. Ne pas exposer de clé secrète.
3. Le déploiement main peut alors publier le catalogue existant sans migration. Panier local et devis restent disponibles ; création de commande Production, paiement et téléchargement payant restent désactivés dans le code.
4. Vérifier accueil, boutique, recherche/filtres, images, SHENA Digital et mobile. Si une régression apparaît, rétablir le précédent déploiement Vercel ; aucun retour arrière SQL n'est nécessaire pour cette publication du code seul.

Contrôle automatisé de configuration, sans réseau ni mutation : `npm run check:deployment -- production`. Ce contrôle ne certifie pas les droits SQL ni la disponibilité distante du catalogue.

## Accès indispensables pour poursuivre à distance

- Accès Vercel limité au projet de référence, pour configurer les variables **Preview uniquement** et reconstruire. Les quatre statuts Vercel associés au dépôt ne prouvent pas qu'ils utilisent tous STAGING.
- Clé publishable SHENA-STAGING et accès SQL/opérateur sécurisés au seul projet `prqmomjtmyhqijysfoog`, domaine autorisé dans l'environnement. Trois identités STAGING distinctes (client et deux admins) sont nécessaires ; les adresses administrateur doivent être confirmées, sans compte fictif ni mot de passe intégré. Aucun secret dans le chat/Git.
- Revue/accord sur les recettes SQL et sur toute future installation persistante. Les fichiers existants gardent ROLLBACK. Les essais STAGING ne valent pas autorisation de modification Production.

Les scripts de création, ACL, admin, Storage et commerce sont déjà prêts pour revue ; voir docs/SPRINT-MVP-STAGING.md. Le correctif final TRUNCATE n'a pas été exécuté. Avant toute modification Production : script persistant explicitement validé, sauvegarde restaurable vérifiée et accord. La vulnérabilité ACL rapportée reste ouverte jusque-là, indépendamment du déploiement du catalogue.

## Preview

Utiliser uniquement les variables publiques SHENA-STAGING, `SHENA_DEPLOYMENT_TARGET=staging`, `SHENA_STAGING_PROJECT_REF=prqmomjtmyhqijysfoog`, `SHENA_CHECKOUT_MODE=disabled` et une origine `SHENA_SITE_URL` correspondant au domaine Vercel de Preview. Contrôle : `npm run check:deployment -- preview` dans ce contexte. Le bandeau signale que seules des données fictives sont admises.

L'activation de commandes STAGING exige ensuite les tests serveur/RLS réels et les tables revues. Les tarifs et la durée de réservation restent des décisions du propriétaire ; ils ne bloquent pas la publication du catalogue seul.
