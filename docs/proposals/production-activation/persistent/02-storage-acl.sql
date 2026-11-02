-- INSTALLATION PERSISTANTE PROPOSÉE : 02-storage-acl. NON EXÉCUTÉE.
-- Source préservée : docs/proposals/production-activation/02-storage-acl-review.sql ; SHA256 3547d957e029ea2232a8e1a674c78e332849732d78773d9e6d1d867125c47170
-- Ne pas exécuter sans revue du fichier exact et approbation explicite.
-- Les paramètres sont des attestations opérateur, pas une preuve de restauration.
-- Aucun script applicatif/build n'exécute ce fichier.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $approval$ BEGIN
 IF current_user<>'postgres'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed'
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '02-storage-acl'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accord de ce script, cible et restauration DB + Storage vérifiés requis'; END IF;
END $approval$;
SET LOCAL shena.acl_review_context='products-acl-reviewed';
-- PROPOSITION NON EXÉCUTÉE : retire seulement les privilèges SQL inutiles des clients.
-- Aucun attribut/appartenance de rôle système, propriétaire ou droit CRUD modifié.

SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Accord Production et restauration vérifiés requis'; END IF;
 IF current_setting('server_version_num')::integer<170000 THEN RAISE EXCEPTION 'PostgreSQL 17+ requis pour MAINTAIN'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class WHERE oid IN('storage.buckets'::regclass,'storage.objects'::regclass) AND relrowsecurity AND relowner NOT IN('anon'::regrole,'authenticated'::regrole))<>2 THEN RAISE EXCEPTION 'RLS et propriétaire Storage non client requis'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
 WHERE c.oid IN('storage.buckets'::regclass,'storage.objects'::regclass) AND a.grantee IN('anon'::regrole,'authenticated'::regrole)
 AND(a.grantor NOT IN(c.relowner,'postgres'::regrole) OR a.is_grantable)) THEN RAISE EXCEPTION 'Grantor ou grant option inattendu : audit avant adaptation'; END IF;
END $guard$;
CREATE TEMP TABLE shena_storage_acl_before ON COMMIT DROP AS
 SELECT r.oid AS role_oid,t.name AS relation,
 pg_catalog.has_table_privilege(r.oid,t.name,'SELECT') AS can_select,
 pg_catalog.has_any_column_privilege(r.oid,t.name,'SELECT') AS column_select,
 pg_catalog.has_table_privilege(r.oid,t.name,'INSERT') AS can_insert,
 pg_catalog.has_any_column_privilege(r.oid,t.name,'INSERT') AS column_insert,
 pg_catalog.has_table_privilege(r.oid,t.name,'UPDATE') AS can_update,
 pg_catalog.has_any_column_privilege(r.oid,t.name,'UPDATE') AS column_update,
 pg_catalog.has_table_privilege(r.oid,t.name,'DELETE') AS can_delete
 FROM pg_catalog.pg_roles r CROSS JOIN(VALUES('storage.buckets'),('storage.objects')) t(name) WHERE r.rolname IN('anon','authenticated');
REVOKE TRUNCATE,TRIGGER,REFERENCES,MAINTAIN ON TABLE storage.buckets,storage.objects FROM anon,authenticated RESTRICT;
DO $verify$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM pg_temp.shena_storage_acl_before LOOP
  IF pg_catalog.has_table_privilege(r.role_oid,r.relation,'TRUNCATE') OR pg_catalog.has_table_privilege(r.role_oid,r.relation,'TRIGGER')
  OR pg_catalog.has_any_column_privilege(r.role_oid,r.relation,'REFERENCES') OR pg_catalog.has_table_privilege(r.role_oid,r.relation,'MAINTAIN') THEN RAISE EXCEPTION 'Privilège dangereux hérité, PUBLIC ou colonne restant : annuler et examiner'; END IF;
  IF pg_catalog.has_table_privilege(r.role_oid,r.relation,'SELECT') IS DISTINCT FROM r.can_select
  OR pg_catalog.has_any_column_privilege(r.role_oid,r.relation,'SELECT') IS DISTINCT FROM r.column_select
  OR pg_catalog.has_table_privilege(r.role_oid,r.relation,'INSERT') IS DISTINCT FROM r.can_insert
  OR pg_catalog.has_any_column_privilege(r.role_oid,r.relation,'INSERT') IS DISTINCT FROM r.column_insert
  OR pg_catalog.has_table_privilege(r.role_oid,r.relation,'UPDATE') IS DISTINCT FROM r.can_update
  OR pg_catalog.has_any_column_privilege(r.role_oid,r.relation,'UPDATE') IS DISTINCT FROM r.column_update
  OR pg_catalog.has_table_privilege(r.role_oid,r.relation,'DELETE') IS DISTINCT FROM r.can_delete THEN RAISE EXCEPTION 'Droits CRUD Storage modifiés : arrêt'; END IF;
 END LOOP;
END $verify$;
-- Version persistante DISTINCTE : les fichiers de revue gardent ROLLBACK.
COMMIT;
