# Revue préalable de production-01-admin.sql

Date : 2 novembre 2026. **Aucune connexion à la base de production, aucune migration, aucun test SQL distant exécuté, aucune fusion GitHub.** Le fichier historique `docs/proposals/production-01-admin.sql` est conservé sans modification. La proposition corrigée reste séparée et se termine par `ROLLBACK`.

## Conclusion et niveau de preuve

Le schéma déclaré par le propriétaire (products existante, RLS active, une politique publique des actifs) est compatible avec l'intention du script historique. Il ne suffit pas à certifier son exécution ni ses permissions effectives : types exacts, typmods, nullabilité, valeurs par défaut, contraintes, ACL, appartenances, fonctions, triggers et définition de la politique ne sont pas disponibles dans un relevé de production vérifié.

Le code historique n'offre pas d'élévation évidente via user_metadata : il ne la lit pas. Sa fonction de rôle relit auth.users pour le sujet authentifié, et ses noms d'objets sensibles sont qualifiés. Cependant, l'absence d'audit des droits existants et de contraintes côté base empêche de conclure « seul un administrateur peut écrire » pour l'ensemble du projet. Les RPC existantes SECURITY DEFINER et les rôles qui contournent RLS doivent aussi être examinés.

**Statut : proposition de revue, pas une autorisation de mise en production.** Les tests locaux réussis ci-dessous ne sont pas des tests RLS réels.

## Fonctions et risques d'élévation

| Fonction historique    | Analyse                                                                                                                                                                                                               | Correction proposée                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shena_is_admin         | SECURITY DEFINER nécessaire pour lire les métadonnées de confiance ; aucun argument ni SQL dynamique. raw_app_meta_data est la bonne source. Propriétaire non fixé explicitement.                                     | Propriétaire postgres explicite et contrôlé ; search_path pg_catalog,pg_temp ; objets qualifiés ; rôle JSON string exact ; EXECUTE seulement authenticated. |
| shena_admin_status     | SECURITY DEFINER inutilement large pour une introspection de capacités. La présence d'un nom de politique ne prouve pas son contenu, ses rôles, RLS ni les ACL. Lecture Storage inutile pour la seule phase produits. | SECURITY INVOKER ; vérification du helper ; manifeste minimal produits seuls. Pas de détection par nom ni de lecture Storage.                               |
| shena_catalog_features | Publique et SECURITY DEFINER, sans besoin de privilèges élevés pour un manifeste. Pas de faille d'injection identifiée dans son corps fixe, mais surface élevée superflue.                                            | SECURITY INVOKER ; constantes fausses pour les modules non audités.                                                                                         |

Le helper conservé est puissant parce qu'il appartient à postgres ; son corps doit rester minimal et fixe. Ce choix évite de modifier les politiques de auth.users ou de créer un rôle BYPASSRLS. Il ne faut pas lui ajouter de paramètre permettant de tester un UUID arbitraire, de SQL dynamique, ni de logique d'écriture. La proposition refuse les rôles clients capables de créer des objets dans public/auth, leurs appartenances sortantes, leurs privilèges dangereux et leurs écritures directes sur auth.users.

`search_path=pg_catalog` dans l'original n'établit pas à lui seul une injection : auth.users et auth.uid sont déjà qualifiés. Ajouter pg_temp explicitement en dernier renforce l'ordre de recherche et facilite la revue des évolutions. Ne pas affirmer qu'une faille exploitable a été démontrée.

Le client ne doit contrôler ni son sub signé, ni le rôle SQL PostgREST. Cela relève de Supabase Auth et de la validation JWT. Un opérateur SQL privilégié peut définir request.jwt.claims pour les tests ; cela ne reproduit pas une attaque possible depuis le navigateur. Aucune clé service ne doit être donnée au client.

## Compatibilité contrôlée et limites

La proposition refuse plutôt que transformer un schéma inattendu. Aucun ALTER TYPE, renommage, effacement, correction de prix ou réinitialisation de stock n'est proposé.

| Élément               | Contrat accepté par la nouvelle proposition                                                                           | Si différent                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Relation              | Table ordinaire public.products, propriétaire postgres, RLS déjà active, sans héritage/partitionnement                | Arrêt et adaptation examinée                                                                 |
| Colonnes              | Exactement id, created_at, name, description, price_htg, product_type, stock, image_url, active                       | Arrêt, notamment si une future colonne sensible existe                                       |
| id                    | uuid, clé primaire simple                                                                                             | Arrêt                                                                                        |
| created_at / active   | timestamptz / boolean ; pas de NULL dans les lignes existantes                                                        | Arrêt, aucun remplissage automatique                                                         |
| Champs texte          | text ou varchar, sans identity/generated                                                                              | Examiner également longueurs varchar, défauts et contraintes préexistantes                   |
| image_url             | Accepte NULL pour la création avant upload                                                                            | Arrêt si NOT NULL                                                                            |
| price_htg             | numeric sans typmod, 0 à 100 000 000 inclus, deux décimales maximum, ni NULL ni NaN/infini                            | numeric(p,s), float, money, domaines : arrêt et revue ; aucun changement de type automatique |
| stock                 | integer ou bigint, 0 à 1 000 000 inclus, non NULL                                                                     | Arrêt si données historiques incompatibles                                                   |
| product_type          | physical, digital, preorder et alias connus déjà reconnus par l'application                                           | Enum/domaine, alias supplémentaire ou valeur différente : arrêt                              |
| Digital / précommande | Stock zéro                                                                                                            | Anciennes données différentes : arrêt, aucune mise à zéro automatique                        |
| Politique publique    | Une SELECT permissive appliquée à anon et authenticated (ou PUBLIC), expression active, active=true ou active IS TRUE | Toute autre expression, même équivalente, doit être revue ; aucun remplacement silencieux    |

Le refus de numeric(p,s) est volontaire : PostgreSQL peut arrondir à l'affectation avant un CHECK. Un CHECK ne peut alors prouver que le prix brut avait seulement deux décimales. Cette version conservatrice exige numeric non borné et vérifie les valeurs stockées. Les conversions implicites d'autres types ne remplacent jamais la validation des charges REST/formulaires.

Les alias reconnus sont listés intégralement dans le SQL : ils ne sont ni normalisés ni injectés dans les données. Les contraintes existantes sont conservées ; une contrainte plus restrictive peut encore refuser un cas positif, ce que la recette staging doit détecter. Le dossier ne prétend pas qu'un parseur a résolu ces dépendances sémantiques.

L'application existante insère explicitement id et created_at ; elle met à jour les sept champs éditables. Les droits de colonne proposés correspondent à ces appels. Modifier id ou created_at après création n'est plus accordé. Les images, catégories, géographie et fichiers privés ne sont pas activés par ce manifeste minimal ; ne pas enchaîner les anciennes propositions 02–05 sans une nouvelle revue de leurs interactions.

## Privilèges et politiques

- L'original ajoute des droits sans retirer les éventuels anciens DELETE, TRUNCATE, TRIGGER ou droits de colonne. RLS ne protège pas TRUNCATE. Ne pas confondre absence de route REST TRUNCATE avec absence du privilège SQL.
- La proposition retire les droits directs de table et de colonne de anon/authenticated, puis accorde SELECT sur les dix colonnes, INSERT sur ces colonnes à authenticated et UPDATE seulement sur les sept champs éditables. Aucun DELETE, TRUNCATE, REFERENCES, TRIGGER ou droit transmissible n'est ajouté.
- REVOKE sur un rôle ne retire pas les droits hérités ou PUBLIC. La proposition refuse toute appartenance sortante de ces rôles et toute écriture PUBLIC sur la table/colonnes. La lecture publique existante reste conservée.
- authenticated représente aussi les clients ordinaires : les grants INSERT/UPDATE sont donc nécessaires mais insuffisants. Les politiques permissives admin et les gardes restrictives exigent toutes le helper de rôle. Une nouvelle politique permissive ne suffira pas, par OR, à ouvrir les écritures à un client tant que ces gardes restent présentes.
- L'UPDATE vérifie les lignes avant et après modification. Dépublier est simplement UPDATE active=false, soumis aux mêmes contrôles. Les administrateurs partagent le catalogue ; aucune isolation entre les deux fondateurs n'est souhaitée ici.
- Les propriétaires, rôles superuser/BYPASSRLS et opérations service_role restent des autorités d'exploitation distinctes : la garantie « administrateur uniquement » vise les visiteurs et comptes applicatifs, pas ces autorités privilégiées.
- Toute RPC public SECURITY DEFINER déjà exécutable par anon/authenticated fait arrêter cette proposition. Examiner aussi les autres schémas exposés par PostgREST, les vues et les privilèges du projet : cet audit produit ne certifie pas toute la plateforme.

## Résultats effectivement obtenus

Mise à jour du sprint : les types/défauts/nullabilités, la PK et la politique ont été confirmés par le propriétaire (voir PRODUCTS-CONFIRMED-SCHEMA.md). Les essais de logique admin et commerce utilisent maintenant PostgreSQL local en mémoire avec Auth/Storage simulés ; les résultats actualisés figurent dans docs/admin/VALIDATION.md. Le tableau ci-dessous conserve la portée de la revue initiale, sans valider Supabase distant.

| Contrôle exécuté dans cette session                          | Résultat                                                                                                                   | Ce qu'il ne prouve pas                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Analyse PostgreSQL des fichiers SQL, y compris assemblage    | Réussie avec pglast 7.22, parseur PostgreSQL 17.7                                                                          | Ni résolution des tables/colonnes ni RLS effective |
| Analyse syntaxique des blocs DO / PL/pgSQL corrigés et tests | Réussie                                                                                                                    | Ni exécution des branches ni droits de l'opérateur |
| Suite statique de revue                                      | 8 tests réussis : syntaxe, ROLLBACK, surface DEFINER, grants, politiques restrictives, UUID et injection dans l'assembleur | Ce n'est pas un moteur PostgreSQL                  |
| npm test                                                     | 43 tests unitaires réussis, dont rôles et validation prix/stock                                                            | Ce ne sont pas des tests du projet Supabase réel   |
| Migration corrigée / protocole RLS staging                   | Préparés, non exécutés                                                                                                     | Aucun résultat RLS réel annoncé                    |
| Production / comptes fondateurs / sauvegarde restaurée       | Non interrogés et non testés                                                                                               | Compatibilité exacte non certifiée                 |

Fichiers : proposition `docs/proposals/production-01-admin-reviewed.sql`, inventaire en lecture seule `production-01-admin-inventory.sql`, tests transactionnels `docs/proposals/tests/admin-products-staging.sql`, assembleur hors base `scripts/prepare-admin-staging.py`. Le protocole opérationnel est dans `docs/security/ADMIN-STAGING-PROCEDURE.md`.
