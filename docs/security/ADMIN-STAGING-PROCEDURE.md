# Protocole de validation SHENA Admin — à approuver, non exécuté

Ce document prépare la recette. **Il n'autorise aucune exécution maintenant.** Ne pas utiliser une connexion de production, ne pas changer ROLLBACK en COMMIT et ne pas envoyer le fichier à Supabase CLI db push. Les scripts ne sont pas intégrés au déploiement ou à la CI comme migrations.

## 1. Prérequis et périmètre

- Projet Supabase de staging distinct, identifié par son project ref, son URL et sa connexion PostgreSQL. Comparer ces trois éléments au tableau de bord ; une étiquette « staging » dans un nom de fichier ne suffit pas.
- Export de la structure réelle : types, nullabilité, défauts, contraintes, politiques, ACL, fonctions, triggers et rôles. Le fichier d'inventaire préparé ne doit être exécuté que par un opérateur habilité, avec l'accord du propriétaire ; les définitions peuvent contenir des secrets historiques. Ne pas publier ses résultats bruts dans GitHub.
- Données de test synthétiques ou restauration préalablement anonymisée, sans véritables coordonnées clients. Ne pas copier de secrets d'exploitation, SMTP ou clés de paiement en staging. Neutraliser les intégrations externes avant toute restauration/test.
- Trois comptes existants du staging : un client ordinaire et deux administrateurs distincts. Identité et email vérifiés ; privilèges app_metadata attribués séparément par l'opérateur habilité. Aucun compte créé ou promu par les scripts de ce dossier.
- Connexion SQL opérateur postgres autorisée à lire auth.users, créer les fonctions/politiques/contraintes sur products, gérer les grants et prendre SET ROLE anon/authenticated. Un utilisateur navigateur n'a pas ces pouvoirs. Vérifier les permissions de l'opérateur et les versions PostgreSQL avant recette.
- Fenêtre sans trafic : le script prend ACCESS EXCLUSIVE sur products, valide les contraintes et lit les données. lock_timeout 3 secondes et statement_timeout 60 secondes sont locaux à la transaction, sans modification durable d'un paramètre. Tout timeout signifie arrêt et revue du volume/fenêtrage, pas désactivation des protections.

La valeur de session `shena.review_context=staging-reviewed` est un garde-fou opératoire déclaratif ; elle **ne prouve pas** que la connexion cible est réellement staging. L'opérateur doit identifier le projet indépendamment avant d'ouvrir la session.

## 2. Sauvegarde et restauration avant toute évolution de production

Conserver une sauvegarde datée de la base (structure et données), l'inventaire des rôles/grants/RLS, les définitions de fonctions et les versions de l'application. Conserver les objets Storage séparément : un dump SQL ne sauvegarde pas leurs octets. Vérifier aussi les mécanismes de restauration Auth/Storage disponibles pour ce projet et les limitations du plan Supabase.

Restaurer dans un projet isolé et vérifier : nombres de produits actifs/inactifs, total et distribution des stocks, prix, contraintes, ACL/RLS, comptes attendus, inventaire des objets et ouverture d'un échantillon de fichiers via leurs droits prévus. Protéger les sauvegardes comme des données sensibles. Consigner date, responsable, source, empreintes des artefacts, résultat et durée de restauration, ainsi que le point de reprise et les écritures potentiellement perdues.

Aucune sauvegarde ni restauration n'a été réalisée ou certifiée dans cette session. Leur résultat doit être fourni avant toute demande d'approbation d'une migration de production.

## 3. Inventaire et décision sur les incompatibilités

Examiner d'abord `docs/proposals/production-01-admin-inventory.sql`, en lecture seule. La partie agrégats suppose des types numériques compatibles : les confirmer avec les premières requêtes avant cette partie. Un résultat vide issu d'un rôle limité n'est pas une preuve d'absence.

Comparer au contrat dans ADMIN-SQL-REVIEW.md. Arrêter notamment sur : numeric(p,s), enum/domaine, stock NULL ou négatif, type non reconnu, image_url NOT NULL, table partitionnée, politique différente, trigger/RPC personnalisée, écriture PUBLIC, appartenance sortante d'un rôle client ou droits sur auth.users. Examiner les schémas exposés PostgREST et RPC existantes susceptibles de contourner RLS.

Produire un plan adapté à chaque différence, sans normaliser ou effacer les anciennes données automatiquement. Les nouvelles contraintes sont proposées, pas supposées déjà présentes. La version corrigée ne doit pas être déclarée exactement compatible avant examen du relevé réel et réussite des cas positifs en staging.

## 4. Préparer le fichier transactionnel sans exécuter de SQL

Commande d'assemblage seulement, après remplacement des trois valeurs par les vrais UUID du staging :

```bash
python3 scripts/prepare-admin-staging.py \
  --client-id '<UUID_CLIENT_STAGING>' \
  --admin-a-id '<UUID_ADMIN_A_STAGING>' \
  --admin-b-id '<UUID_ADMIN_B_STAGING>' \
  --output /tmp/shena-admin-staging-review.sql
```

L'assembleur vérifie les UUID et leur distinction, insère les tests à l'emplacement réservé et conserve le ROLLBACK final. Il refuse d'écraser un fichier existant. Il ne demande ni URL, ni clé, ni mot de passe, n'importe aucun pilote SQL et ne lance pas psql. Le fichier généré contient des UUID internes : ne pas le committer.

Contrôler manuellement le fichier assemblé, sa dernière instruction, les chemins utilisés, les UUID, le diff de la proposition et l'absence de COMMIT. Ne pas charger les scripts par fragments : la transaction doit envelopper tout le DDL, les fixtures et les tests.

## 5. Exécution staging ultérieure, seulement après accord

Configurer hors dépôt un service psql explicitement nommé `shena_staging`, vérifié contre le project ref. TLS doit valider le certificat ; mot de passe conservé dans un gestionnaire approprié, pas dans la commande ou le fichier SQL. Exemple **non exécuté ici** :

```bash
psql 'service=shena_staging sslmode=verify-full' \
  --no-psqlrc --set ON_ERROR_STOP=1 \
  --file /tmp/shena-admin-staging-review.sql
```

Le SQL prend sa propre transaction ; ne pas utiliser d'outil qui enlève BEGIN/ROLLBACK ou réexécute isolément les instructions. Sur erreur, ON_ERROR_STOP arrête psql et la connexion fermée annule la transaction. En console interactive, demander explicitement ROLLBACK si la transaction est en échec. Ne pas corriger une erreur en supprimant un garde-fou.

La réussite attendue inclut les notices PASS et la terminaison par ROLLBACK. Les produits de test, fonctions, politiques, contraintes, ACL et métadonnées Auth temporaires doivent alors être revenus à leur état initial. Relever à nouveau schéma, privilèges et comptes, puis comparer à l'inventaire initial sans publier de données sensibles. Une ligne « PASS » sans ROLLBACK final et comparaison ne suffit pas.

## 6. Matrice des tests préparés

| Identité / cas                                | Attendu dans le protocole SQL                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Anonyme                                       | Voit les actifs, pas les inactifs ; INSERT/UPDATE et RPC admin refusés                                                         |
| Client normal                                 | Voit les actifs ; INSERT refusé ; UPDATE prix/active sur une ligne existante affecte zéro ligne ; pas d'accès RPC admin        |
| Client avec user_metadata.shena_role=admin    | Reste non-admin ; la métadonnée est mise temporairement en staging par l'opérateur et annulée                                  |
| Client avec faux claim JWT app_metadata admin | Reste non-admin car le rôle est relu dans auth.users ; simulation SQL, pas un JWT réel signé                                   |
| Admin A                                       | Lit les actifs/inactifs ; crée, modifie prix/stock, dépublie sans supprimer ; pas de DELETE ni modification d'id               |
| Admin B                                       | Compte distinct ; crée, modifie et dépublie un produit digital à stock zéro                                                    |
| Admin B révoqué                               | Le helper refuse le rôle malgré sa session/claims antérieurs ; nouvelle écriture sans effet                                    |
| Valeurs invalides                             | Prix négatif, NaN, trop élevé, trois décimales ; stock négatif/NULL/trop élevé ; type inconnu et stock digital non nul refusés |
| ACL                                           | Pas de TRUNCATE pour anon/authenticated ; id/created_at non modifiables ; pas de DELETE applicatif                             |

Les tests n'appellent jamais TRUNCATE. Le contrôle de ce privilège est fait par introspection. Ils ne créent pas d'admin, ne modifient aucun prix historique et n'effacent aucun produit. Ils modifient **temporairement** les métadonnées de deux comptes dédiés du staging et créent des produits de test dans la transaction ; ce n'est donc pas un protocole de lecture seule, même si tout se termine par ROLLBACK. Des effets externes déclenchés par un trigger ne sont pas nécessairement annulables : neutraliser les intégrations et examiner les triggers Auth avant ces tests.

## 7. Complément HTTP/Auth à préparer pour une phase suivante

Les autres connexions PostgreSQL, PostgREST et l'application ne voient pas les nouveaux objets DDL non validés dans la transaction de test. **Il est impossible de prétendre valider les nouvelles politiques via HTTP pendant ce protocole ROLLBACK.** Une recette HTTP complète requerra une installation persistante en staging faisant l'objet d'une approbation distincte ; aucun script persistant n'est fourni ou exécuté dans cette mission.

Après cette approbation distincte, les essais HTTP devront utiliser la clé publique du staging et de vraies sessions séparées :

1. Connexion/déconnexion des trois comptes, JWT signé et expiré ; aucune clé service dans les requêtes client.
2. Lecture catalogue anonyme et client : actifs seulement. Requêtes directes REST INSERT/PATCH sur des fixtures : aucun produit créé/modifié/dépublié par le client. Un PATCH avec zéro ligne et réponse vide n'est pas une écriture réussie ; contrôler la ligne depuis un observateur autorisé.
3. Avec le client, demander via Supabase Auth une modification de ses données utilisateur contenant shena_role=admin ; vérifier qu'il n'obtient pas app_metadata.shena_role ni le rôle serveur. Essayer une charge visant app_metadata : ne pas supposer son rejet/ignorance sans observer le résultat.
4. Pour chacun des deux administrateurs, création, édition et dépublication via l'interface puis REST direct. Tester prix/stock malformés, type arbitraire, stock fractionnaire JSON et invalidation des formulaires concurrents. Vérifier aussi les contraintes existantes plus strictes.
5. Révocation d'un rôle sur le compte de test par l'opérateur, puis nouvel appel avec son ancienne session : écriture interdite. Revalider toute route serveur et RPC d'écriture.
6. Vérifier les politiques nouvellement installées, pas seulement le manifeste. Rester sans commandes, paiements ni téléchargements payants.

Ces essais ne sont pas exécutés ni annoncés réussis dans le rapport actuel.

## 8. Retour arrière et critères d'approbation

Pour ce protocole : le ROLLBACK final ou l'abandon de la connexion annule les changements transactionnels. Comparer l'état final à l'état initial. Les paramètres ajoutés par l'assembleur sont de session, sans ALTER DATABASE/ROLE/SYSTEM ; fermer la connexion les élimine.

Pour une éventuelle future installation persistante : ne pas réutiliser ce fichier en remplaçant ROLLBACK par COMMIT. Préparer un autre artefact d'exécution explicitement revu et approuvé, accompagné d'un script de retour arrière tiré de l'inventaire réel. Celui-ci devra retirer uniquement les objets ajoutés, rétablir exactement les ACL antérieures et conserver produits, prix, stocks et politique publique préexistante. Ne pas accorder ALL ni désactiver RLS pour « revenir en arrière ». Vérifier les dépendances avant de retirer le helper ; aucun DROP CASCADE ou TRUNCATE.

Une restauration globale de production peut perdre des écritures récentes ; elle demande une décision explicite, un rapprochement et une fenêtre d'exploitation. Revenir uniquement à l'ancien déploiement applicatif ne rétablit pas les privilèges SQL.

Avant toute approbation de production, fournir : relevé réel examiné, diff final du SQL adapté, restauration de sauvegarde vérifiée, sorties RLS staging, résultats HTTP/Auth complémentaires, propriétaires et ACL de fonctions vérifiés, durée des verrous mesurée, plan de retour arrière testé et identité de l'opérateur. Aucun de ces résultats réels n'est inventé ici.

## Reproduire les contrôles hors base déjà exécutés

```bash
python3 -m pip install --target /tmp/shena-sql-parser -r tests/requirements-sql-review.txt
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/shena-sql-parser python3 tests/test_admin_sql_review.py
npm test
```

pglast analyse la syntaxe PostgreSQL et PL/pgSQL sans moteur ni connexion. La version épinglée utilise un parseur PostgreSQL 17.7 ; comparer à la version du staging. Un parseur ne prouve pas la compatibilité avec les objets réels ni le comportement de RLS.

## Mise à jour : STAGING vide et structure confirmée

Le bootstrap fidèle est maintenant préparé dans `docs/proposals/staging/00-products-bootstrap-review.sql`. Pour une recette sur projet vide, utiliser le nouvel assembleur **hors base** `scripts/prepare-staging-validation.py --mode admin --client-id UUID_CLIENT --admin-a-id UUID_ADMIN_A --admin-b-id UUID_ADMIN_B --output /tmp/shena-admin-review.sql` avec trois vrais UUID distincts de staging. Cette commande ne fait qu'écrire un fichier ; l'examiner avant tout essai approuvé. Il contient bootstrap, fixtures synthétiques, correctif ACL, migration admin et tests dans une seule transaction, avec ROLLBACK final. Aucun COMMIT n'est introduit. Le protocole du fichier STAGING-EMPTY-PROJECT.md explique les étapes et les limites.
