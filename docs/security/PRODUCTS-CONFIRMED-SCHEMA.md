# products — métadonnées confirmées et préparation STAGING

Source : relevé de métadonnées Production communiqué par le propriétaire, 2 novembre 2026. Aucune requête SQL Production exécutée par l'assistant, aucune donnée ni aucun compte copié. Ce relevé n'est pas une restauration vérifiée ni un audit de sécurité complet.

| Colonne      | Type exact               | NOT NULL | Défaut                |
| ------------ | ------------------------ | -------- | --------------------- |
| id           | uuid                     | oui      | gen_random_uuid()     |
| created_at   | timestamp with time zone | oui      | now()                 |
| name         | text                     | non      | aucun défaut rapporté |
| description  | text                     | non      | aucun défaut rapporté |
| price_htg    | numeric sans typmod      | non      | aucun défaut rapporté |
| product_type | text                     | non      | aucun défaut rapporté |
| stock        | integer                  | non      | 0                     |
| image_url    | text                     | non      | aucun défaut rapporté |
| active       | boolean                  | non      | false                 |

Les valeurs NULL du relevé de défauts sont interprétées comme l'absence de DEFAULT, conformément à la sortie habituelle des catalogues ; si elles désignent des expressions DEFAULT NULL explicites, fournir leurs expressions exactes avant exécution.

Seule contrainte rapportée : `"SHENA_pkey" PRIMARY KEY (id)`, validée. Aucun CHECK, UNIQUE additionnel ou FK. RLS active, FORCE RLS false. Politique `"Public can view active product"`, PERMISSIVE, SELECT pour anon et authenticated, USING `(active = true)`, WITH CHECK absent.

Le DDL complet préparé est `docs/proposals/staging/00-products-bootstrap-review.sql`. Il reproduit ces dix colonnes, défauts, nullabilité, clé et politique. La casse du nom SHENA_pkey est conservée par des guillemets. Il ne crée ni compte, ni extension supposée, ni fonction privilégiée, ni contrainte admin. La seule ligne insérée est un produit fictif inactif ; ses id/date utilisent les défauts confirmés.

RLS est activée avant les grants clients, dans la même transaction que la création. Les grants Supabase par défaut sont révoqués pour la nouvelle table avant SELECT. **Écart intentionnel à Production : les grants dangereux ne sont pas reproduits**, même s'ils font partie du relevé source. Le propriétaire/les index autonomes/triggers/règles et les permissions de schéma ne sont pas attestés par les informations reçues ; ne pas annoncer une copie exhaustive de tous les objets ou un test de restauration.

## Compatibilité avec la migration admin corrigée

Les types confirmés satisfont le contrat statique de production-01-admin-reviewed.sql : uuid, timestamptz, text, numeric sans typmod, integer, boolean et image nullable. Le nom de la PK n'est pas imposé par cette migration, seulement la PK simple sur id. La politique confirmée est une expression acceptée et cible les deux rôles attendus.

La nullabilité historique est **conservée dans le bootstrap**. La proposition admin ajoute ensuite des CHECK et une validation des données plus strictes : des lignes historiques NULL, prix invalides, types non reconnus ou stocks incohérents peuvent la faire échouer. Aucune donnée réelle n'a été examinée et aucune valeur ne sera corrigée automatiquement. La fixture staging est compatible ; ce n'est pas une preuve que les données Production le sont.

Le correctif ACL accepte maintenant deux états : les seize entrées directes source confirmées ou deux SELECT directs pour un staging déjà sécurisé. Le bootstrap normal est donc compatible avec lui sans réintroduire les privilèges dangereux. Son exécution dans cet état montre l'idempotence et les refus, pas l'effet de révocation à partir des grants excessifs.

Une simulation de ces grants est préparée dans `docs/proposals/tests/products-acl-unsafe-stage-simulation-review.sql`. Elle est bloquée sans accord explicite, n'est jamais exécutée localement et ne doit être utilisée qu'en staging isolé, dans une transaction unique avec correctif, tests et ROLLBACK final. Les autres connexions ne doivent jamais voir ces grants validés. Cette justification de test n'autorise pas leur reproduction persistante.

## Avant toute exécution

1. Confirmer la cible SHENA-STAGING `prqmomjtmyhqijysfoog`, son URL, la version PostgreSQL et le propriétaire opérateur. Les étiquettes de session sont déclaratives et ne vérifient pas la connexion.
2. Examiner le SQL, les dépendances/defaults, schéma USAGE/CREATE, fonctions privilégiées et appartenances ; ne toucher ni aux rôles système ni à leurs membres.
3. Approuver séparément le bootstrap en revue, le protocole ACL staging et éventuellement la simulation de panne. Les fichiers gardent ROLLBACK ; aucune table persistante ne résulte de cette version de revue.
4. Pour les tests RLS admin, préparer trois comptes réels propres au staging (un client et deux admins distincts), sans copier Auth Production et sans mot de passe intégré. Contrôler anonymat, faux user_metadata, révocation, prix/stock et publication.
5. Une installation persistante staging, le stockage et les migrations commerce demandent chacun leur revue/accord. Ne pas substituer un COMMIT aux fichiers de revue. Les tests HTTP externes ne voient pas le DDL non validé dans une autre connexion.
6. Avant Production : sauvegarde et restauration vérifiées, résultats staging réels et approbation explicite. Aucun rôle système, politique existante ou donnée Production n'est modifié par cette préparation.
