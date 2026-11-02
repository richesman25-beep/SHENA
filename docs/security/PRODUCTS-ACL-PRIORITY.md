# SHENA — risque TRUNCATE et correction ACL prioritaire

## Résultat rapporté et urgence

Le propriétaire rapporte SELECT, INSERT, UPDATE, DELETE et TRUNCATE effectifs pour anon et authenticated sur public.products, RLS active et une politique SELECT nommée « Public can view active product ». Le propriétaire a ensuite confirmé les sources : grants directs par postgres, sans grant option, de SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN à chacun des deux rôles ; aucune ACL de colonne ni attribution PUBLIC de table. Ces résultats sont rapportés par le propriétaire, pas issus d’une connexion exécutée par nous. Aucune commande SQL de Production n'est exécutée dans cette mission.

**TRUNCATE est un privilège à retirer en priorité : RLS ne le filtre pas.** S'il existe un chemin d'exécution SQL sous ces rôles, il permet de vider la table entière, sans WHERE ni contrôle ligne par ligne. Les triggers DELETE ne remplacent pas cette protection ; d'éventuels triggers TRUNCATE sont distincts. TRUNCATE est transactionnel dans PostgreSQL, mais un essai réel sur Production, même suivi d'un rollback, prend des verrous et peut déclencher des effets externes. Aucun essai destructif n'est autorisé en Production.

Le simple privilège ne prouve pas l'existence d'une route HTTP exploitable : PostgREST standard n'expose pas une commande TRUNCATE arbitraire. Il faut néanmoins rechercher les RPC/routines SECURITY DEFINER, SQL dynamique, appels transitifs, routes serveur dotées de secrets, accès SQL directs et capacités SET ROLE. Avec CASCADE, des tables dépendantes pourraient aussi être concernées si les permissions nécessaires sont réunies ; ne jamais utiliser CASCADE pour tester.

Pour INSERT/UPDATE/DELETE, l'absence de politique correspondante bloque normalement les rôles soumis à RLS : INSERT refusé, UPDATE/DELETE souvent zéro ligne. Les propriétaires, BYPASSRLS, fonctions privilégiées et TRUNCATE sont des chemins différents. Des grants inutiles restent une défense manquante en cas de future politique permissive erronée.

## Fichiers proposés, tous non exécutés

- `docs/proposals/production-00-products-acl-inventory.sql` : lecture seule, ACL table/colonnes, grantor/grant option, droits effectifs, graphe récursif de membres, options SET/INHERIT, propriétés des rôles, politiques, fonctions, vues, triggers et default privileges.
- `docs/proposals/production-00-products-acl-revoke-reviewed.sql` : retire seulement les écritures/privileges non nécessaires de anon/authenticated ; ne révoque pas SELECT, ne change ni RLS ni politique, types, contraintes, défauts ou lignes de produits. Garde-fous et ROLLBACK final.
- `docs/proposals/tests/products-acl-staging.sql` : tests préparés uniquement pour staging, avant installation de l'administration. Aucune fixture ajoutée et DML à zéro ligne ; TRUNCATE tenté seulement après preuve ACL de refus attendue. Ne jamais exécuter ces tests en Production.

Le cœur minimal final est REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.products FROM anon,authenticated RESTRICT. C’est la seule instruction de correction. Aucune révocation de colonne n’est ajoutée puisque l’inventaire confirmé n’en contient aucune ; un garde-fou exige un nouvel examen si cet état a changé.

Le correctif ne révoque pas aveuglément les privilèges de PUBLIC ou d'un rôle partagé et ne change pas les appartenances. Si un droit effectif reste présent, ou si un chemin d'appartenance sortant existe, il échoue : les changements de cette transaction sont annulés. Il ne faut donc **pas annoncer la suppression du risque** après un tel échec. À partir de l'inventaire, préparer une révocation ciblée à la source ou un changement de membres explicitement revu, en évaluant les autres utilisateurs touchés. RESTRICT évite les cascades sur des grants dépendants ; un échec lié aux grantors/grant options exige aussi une analyse, pas un remplacement par CASCADE.

Les privilèges des futures tables et ceux accordés par des migrations ultérieures ne sont pas modifiés globalement. MAINTAIN est confirmé dans le relevé et fait donc partie des sept privilèges retirés. Le script exige PostgreSQL 17+ et accepte les seize entrées directes source ou les deux SELECT d’un staging déjà sécurisé avant correction.

## Chemins serveur examinés dans le dépôt

L'examen porte sur la branche de travail et la référence locale origin/main ; il ne prouve pas le contenu réellement déployé ni les fonctions installées dans Supabase.

| Chemin                           | Constat dans le code                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| src/lib/supabase/config.ts       | Clé publishable/anon seulement ; refus sb_secret_ et JWT service_role                                                                                  |
| src/lib/supabase/server.ts       | SDK SSR avec session de l'utilisateur ; pas de client service_role                                                                                     |
| src/lib/supabase/public.ts       | Client public sans persistance de session                                                                                                              |
| src/lib/admin/auth.ts            | getUser vérifié, rôle app_metadata strict, capacités requises ; user_metadata ne donne aucun rôle                                                      |
| src/app/admin/actions.ts         | Création/édition/publication protégées par requireAdmin(products), upload par images + products ; aucune suppression définitive de produit ni TRUNCATE |
| src/app/admin/media-actions.ts   | RPC images/catégories après requireAdmin ; elles peuvent être privilégiées si installées et doivent être auditées en base                              |
| src/app/admin/digital-actions.ts | Écriture métadonnées après contrôle de rôle/capacité                                                                                                   |
| src/app/admin/auth/*/route.ts    | Callbacks Auth, pas de commande SQL arbitraire                                                                                                         |

Aucun chemin TRUNCATE ni client service_role opérationnel n'a été trouvé dans ces sources. Les fonctions SQL proposées pour les médias peuvent modifier products sous droits élevés après vérification admin ; elles ne sont pas réputées installées. Les RPC Supabase réelles, Edge Functions, tâches externes et secrets Vercel restent à inventorier. Ne pas limiter la recherche des fonctions au texte « TRUNCATE » : SQL dynamique et appels indirects peuvent le masquer.

## Ordre sécurisé proposé

1. Après autorisation distincte, relever en lecture seule les métadonnées réelles et conserver les ACL brutes, grantors/options, propriétaires, membres et politiques. Identifier le projet et la version PostgreSQL ; pas de secret dans les fichiers Git.
2. Sauvegarder la base et vérifier une restauration isolée avant modification réelle ; conserver les artefacts de permissions pour le retour arrière. Un dump SQL ne sauvegarde pas les octets Storage.
3. Compléter la reproduction structurelle de SHENA-STAGING depuis le vrai DDL Production. Le projet de staging actuellement déclaré vide ne peut pas exécuter les tests products tant que cette table n'existe pas ; ne pas inventer les types pour débloquer la recette.
4. Examiner les sources des grants. Compléter le plan si PUBLIC, héritage, propriétés de rôle ou routine privilégiée permettent encore l'opération. Choisir une fenêtre opérateur ; ne lancer aucun test TRUNCATE de Production.
5. Après accord, tester le correctif en staging dans UNE transaction : définir shena.acl_review_context=products-acl-reviewed et shena.review_context=staging-reviewed dans cette session ; insérer le fichier de tests au marqueur prévu dans une copie revue ; conserver un seul BEGIN et ROLLBACK final. Ces étiquettes ne prouvent pas l'identité du projet : la vérifier au Dashboard et sur la connexion.
6. Vérifier SELECT, droits effectifs false pour écritures, absence de changement de politique, refus 42501, puis rollback et comparaison d'état. Avec une fixture préexistante contrôlée, confirmer que la lecture active fonctionne et les inactifs restent invisibles. Une table vide ne suffit pas à valider positivement la politique.
7. Présenter les résultats et un artefact de correction persistant adapté aux grants réels pour approbation Production. Le fichier livré reste un dry-run avec ROLLBACK et ne corrige pas durablement Production tel quel. Aucune substitution automatique de COMMIT.
8. Une fois la correction persistante explicitement approuvée et appliquée par l'opérateur, vérifier les ACL effectives de Production en lecture seule ; aucune tentative de TRUNCATE/DML de test sur Production. Rechercher aussi les chemins privilégiés indépendants.
9. Tester séparément l'administration corrigée en staging. Ne fusionner aucune PR automatiquement.

## Compatibilité avec production-01-admin-reviewed.sql

Compatible en ordre de préparation : le correctif ACL vient **avant** la migration admin. Il ne crée aucune table/fonction/politique et conserve la politique SELECT unique attendue. Le type des colonnes n'est pas nécessaire pour cette révocation dynamique, la structure rapportée est désormais documentée dans PRODUCTS-CONFIRMED-SCHEMA.md. La compatibilité des données historiques reste à vérifier.

La migration admin réaccorde ensuite INSERT sur les colonnes connues et UPDATE sur les sept colonnes éditables au rôle authenticated, avec politiques admin et gardes restrictives. Les clients ordinaires partagent ce rôle SQL : has_table_privilege ou has_any_column_privilege ne peut donc plus suffire à distinguer client et admin après cette étape. Tester le résultat effectif RLS avec un vrai client et deux admins. TRUNCATE/DELETE restent interdits à tous les comptes applicatifs, y compris administrateurs.

Ne pas réappliquer la révocation pré-admin après l'administration : elle retirerait les droits nécessaires aux fondateurs. Le garde-fou sur la politique SELECT unique fait arrêter le script si les politiques admin sont présentes. Les tests ACL pré-admin attendent INSERT/UPDATE sans privilège ; les tests admin attendent INSERT client refusé et UPDATE client sans effet sous RLS. Ce sont deux états et deux suites distincts.

## Retour arrière

Dans les fichiers de revue, ROLLBACK ou fermeture d'une connexion en échec annule les changements ACL transactionnels. Rien n'est appliqué maintenant. Les paramètres SET LOCAL ne persistent pas.

Après une éventuelle correction persistante, restaurer SELECT seulement s'il est réellement affecté, avec l'inventaire validé ; ce correctif ne le retire pas. Préférer une réparation ciblée qui conserve TRUNCATE interdit. Revenir au code applicatif précédent ne restaure pas les privilèges SQL.

Un rétablissement exact des ACL exige les entrées table et colonnes, grantors, grant options et appartenances avant changement. Le relevé détaillé permet maintenant de préparer le rétablissement des sept grants directs retirés, par postgres et sans grant option. Le candidat dans production-00-products-acl-rollback-review.sql est commenté et bloqué par une exception ; il n’est jamais appliqué automatiquement. Aucun GRANT ALL n’est proposé. Si un véritable rollback réouvrant un privilège dangereux est indispensable, il demande une nouvelle approbation explicite, un plan de confinement et un script dérivé des ACL sauvegardées. Aucun DROP, TRUNCATE, désactivation RLS ni CASCADE n'est une méthode de retour arrière.

## Résultats et limites

Les résultats de Production sont ceux rapportés par le propriétaire. Les fichiers sont préparés pour analyse statique et tests staging ; aucun refus réel de TRUNCATE ou test de politique Supabase n'est annoncé sans exécution autorisée. Le fichier de tests contient une tentative TRUNCATE destinée uniquement à un staging isolé, sans accès accordé, pas une preuve déjà obtenue.

## Sens des appartenances système confirmé

Le propriétaire rapporte authenticator, postgres et supabase_realtime_admin membres de anon et authenticated, grants par supabase_admin. Cela signifie que les rôles système sont membres des rôles clients (roleid=anon/authenticated, member=rôle système), et non que les clients sont membres des rôles système. Ne pas inverser ces deux colonnes. Le correctif ne change ni ces appartenances, ni attribut, propriétaire ou privilège global de rôle. Les droits propres du propriétaire postgres restent une autorité distincte. Les consommateurs héritant des rôles clients perdent aussi les droits de table retirés ; SELECT reste disponible. Vérifier les services Realtime sur staging, sans modifier leurs rôles.

Les permissions de schéma USAGE et CREATE, les attributs des rôles et les fonctions réellement installées restent à relever. Un avertissement CREATE ne rétablit aucun droit retiré et appelle une correction distincte avant administration. Le script ne modifie aucun schéma ni rôle système.

## Restriction actuelle des essais

Sur instruction explicite du propriétaire après l’audit détaillé, la version finale incluant MAINTAIN est contrôlée statiquement seulement dans cet environnement. Ses tests d’exécution sont réservés exclusivement à SHENA-STAGING après reproduction exacte de products et autorisation. Les essais d’une version antérieure sur un modèle PostgreSQL local ne constituent ni les résultats de cette version finale ni une validation de Production. Les suites locales de logique métier/admin/commandes sont distinctes et ne doivent pas être présentées comme une preuve d’application de ce correctif.
