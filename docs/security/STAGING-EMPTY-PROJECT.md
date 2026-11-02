# Préparation de SHENA-STAGING vide

Les métadonnées de Production ont été confirmées par le propriétaire. Le schéma public de STAGING est déclaré vide ; aucune connexion n'a été effectuée pour le vérifier. Aucune requête SQL distante n'est exécutée par cette préparation.

Le fichier `docs/proposals/staging/00-products-bootstrap-review.sql` contient désormais le DDL des **dix** colonnes rapportées, leurs types, défauts, nullabilité, la clé primaire `"SHENA_pkey"` et la politique SELECT exacte. RLS est activée avant les grants. Seul SELECT est accordé aux clients ; les ACL dangereuses de Production ne sont pas copiées. Un produit fictif inactif est prévu, sans compte ni donnée personnelle. La transaction se termine par ROLLBACK : elle ne laisse aucune table persistante.

Le relevé détaillé et les limites sont dans [PRODUCTS-CONFIRMED-SCHEMA.md](PRODUCTS-CONFIRMED-SCHEMA.md). Le propriétaire source, les éventuels index autonomes, triggers, règles, droits de schéma et fonctions installées restent à vérifier. Aucun changement de rôle système n'est proposé.

## Fichier de recette à examiner

Cette commande écrit un fichier SQL, sans connexion ni exécution :

```sh
python3 scripts/prepare-staging-validation.py --mode acl --output /tmp/shena-staging-acl-review.sql
```

Elle assemble dans une seule transaction le bootstrap, une seconde fixture active pour vérifier positivement la lecture, le correctif ACL et ses tests, puis ROLLBACK. La cible déclarée est `prqmomjtmyhqijysfoog` ; cette déclaration ne prouve pas l'identité de la connexion. L'opérateur doit vérifier le Dashboard et le projet avant tout essai approuvé.

Le mode normal part de droits déjà sécurisés : il teste les refus, mais ne démontre pas la révocation à partir d'un état vulnérable. L'option `--simulate-original-grants` prépare une injection temporaire des sept grants dangereux, exclusivement pour une recette isolée et avec un verrou d'approbation distinct. Ne pas l'exécuter sans cet accord ; ne jamais valider ces grants dans une transaction persistante.

Pour ajouter les tests admin, utiliser `--mode admin` avec `--client-id`, `--admin-a-id` et `--admin-b-id`, correspondant à trois comptes réels dédiés au staging. Aucun compte n'est créé par l'assembleur. Aucun UUID fictif ou mot de passe intégré ne remplace ces comptes. Voir [ADMIN-STAGING-PROCEDURE.md](ADMIN-STAGING-PROCEDURE.md).

## Ordre de validation

1. Examiner les scripts, vérifier la cible et inventorier schémas, ACL, appartenances sortantes et fonctions privilégiées. PostgreSQL 17+ est requis par le correctif MAINTAIN.
2. Approuver la recette transactionnelle avant son exécution exclusivement sur SHENA-STAGING. Conserver les notices et vérifier le ROLLBACK final.
3. Vérifier lecture des actifs/invisibilité des inactifs et refus de TRUNCATE, INSERT, UPDATE et DELETE avant administration.
4. Tester séparément la migration admin corrigée : anonyme, client, faux user_metadata, deux admins, révocation de rôle, création/modification/dépublication et contraintes prix/stock/types. Les grants INSERT/UPDATE de colonnes réintroduits pour authenticated sont alors protégés par RLS ; leur présence seule ne signifie pas qu'un client peut écrire.
5. Une installation persistante STAGING nécessite un artefact et un accord distincts. Ne pas remplacer ROLLBACK par COMMIT. Auth/REST/Storage dans d'autres connexions ne voient pas le DDL non validé de cette recette.
6. Examiner ensuite les propositions Storage et commerce, leurs réglages et la Preview isolée. Aucune commande réelle, aucun paiement ni fichier payant délivré avant validation.

## Sauvegarde et retour arrière

Sur le projet vide, le ROLLBACK doit laisser public sans les objets de recette. Sur un staging déjà utilisé, inventorier et sauvegarder avant modification ; vérifier une restauration isolée. Examiner les triggers et effets externes, qu'un rollback ne garantit pas d'annuler. Les octets Storage ne sont pas inclus dans un simple dump SQL.

Avant toute opération Production : sauvegarde restaurée et vérifiée, résultats staging réels, revue du script persistant et approbation explicite. Aucun de ces prérequis Production n'est déclaré satisfait ici.
