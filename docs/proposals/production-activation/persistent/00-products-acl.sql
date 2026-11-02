-- INSTALLATION PERSISTANTE PROPOSÉE : 00-products-acl. NON EXÉCUTÉE.
-- Source préservée : docs/proposals/production-00-products-acl-revoke-reviewed.sql ; SHA256 1b931910ba20c5f449c92f45442cb3705ce0e0e35907e60afbc2c72aaa5f7f99
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
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '00-products-acl'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accord de ce script, cible et restauration DB + Storage vérifiés requis'; END IF;
END $approval$;
SET LOCAL shena.acl_review_context='products-acl-reviewed';
-- CORRECTIF MINIMAL FINAL PROPOSÉ POUR REVUE — NON EXÉCUTÉ.
-- Source : inventaire rapporté par le propriétaire, grants directs postgres,
-- huit privilèges par rôle, aucun grant option, aucune ACL de colonne/PUBLIC.
-- Accepte aussi le staging déjà sécurisé : SELECT seul par rôle.
-- Aucune donnée, politique RLS, fonction, contrainte, type ou rôle système modifié.

SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE t oid:='public.products'::regclass; policy_expression text;
BEGIN
 IF current_setting('shena.acl_review_context',true) IS DISTINCT FROM 'products-acl-reviewed' THEN
   RAISE EXCEPTION 'Revue ACL et cible identifiée requises ; ce paramètre ne prouve pas la cible'; END IF;
 IF current_setting('server_version_num')::integer<170000 THEN
   RAISE EXCEPTION 'MAINTAIN exige PostgreSQL 17+ : vérifier la version réelle'; END IF;
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class
   WHERE oid=t AND relkind='r' AND relrowsecurity AND relowner='postgres'::regrole) THEN
   RAISE EXCEPTION 'Opérateur postgres, table ordinaire appartenant à postgres et RLS active requis'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid=t)<>1 THEN
   RAISE EXCEPTION 'Une seule politique SELECT attendue ; ne pas réappliquer après la migration admin'; END IF;
 SELECT pg_catalog.pg_get_expr(polqual,polrelid) INTO policy_expression FROM pg_catalog.pg_policy
   WHERE polrelid=t AND polcmd='r' AND polpermissive AND polwithcheck IS NULL
   AND cardinality(polroles)=2 AND 'anon'::regrole=ANY(polroles) AND 'authenticated'::regrole=ANY(polroles);
 IF policy_expression IS NULL OR policy_expression NOT IN('active','(active = true)','(active IS TRUE)') THEN
   RAISE EXCEPTION 'Politique différente du relevé : arrêt sans modification'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped AND cardinality(attacl)>0) THEN
   RAISE EXCEPTION 'ACL de colonne inattendue : nouvel examen requis'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a WHERE c.oid=t AND a.grantee=0) THEN
   RAISE EXCEPTION 'Grant PUBLIC inattendu : nouvel examen requis'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
   WHERE c.oid=t AND a.grantee IN('anon'::regrole,'authenticated'::regrole)) NOT IN(2,16)
 OR (SELECT count(*) FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
   WHERE c.oid=t AND a.grantee IN('anon'::regrole,'authenticated'::regrole) AND a.privilege_type='SELECT')<>2
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
   WHERE c.oid=t AND a.grantee IN('anon'::regrole,'authenticated'::regrole) AND
   (a.grantor<>'postgres'::regrole OR a.is_grantable OR a.privilege_type NOT IN('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))) THEN
   RAISE EXCEPTION 'Grants directs différents des deux états approuvables (source ou SELECT seul) : arrêt'; END IF;
END $guard$;

-- Seule instruction de correction. SELECT reste inchangé. Pas de CASCADE.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN
 ON TABLE public.products FROM anon,authenticated RESTRICT;

-- Vérifier les droits effectifs, pas seulement les entrées directes retirées.
DO $effective$
DECLARE r record;
BEGIN
 FOR r IN SELECT oid,rolname,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated') LOOP
   IF r.rolsuper OR r.rolbypassrls
      OR pg_catalog.has_any_column_privilege(r.oid,'public.products','INSERT')
      OR pg_catalog.has_any_column_privilege(r.oid,'public.products','UPDATE')
      OR pg_catalog.has_table_privilege(r.oid,'public.products','DELETE')
      OR pg_catalog.has_table_privilege(r.oid,'public.products','TRUNCATE')
      OR pg_catalog.has_any_column_privilege(r.oid,'public.products','REFERENCES')
      OR pg_catalog.has_table_privilege(r.oid,'public.products','TRIGGER')
      OR pg_catalog.has_table_privilege(r.oid,'public.products','MAINTAIN') THEN
     RAISE EXCEPTION 'Droits effectifs dangereux restants pour % : PUBLIC/héritage/propriétaire à examiner ; transaction annulée',r.rolname;
   END IF;
   IF NOT pg_catalog.has_table_privilege(r.oid,'public.products','SELECT')
      OR NOT pg_catalog.has_schema_privilege(r.oid,'public','USAGE') THEN
     RAISE EXCEPTION 'Lecture/schema non disponibles pour % : arrêt',r.rolname; END IF;
   -- member=r.oid = appartenance SORTANTE. Ne pas inverser avec roleid=r.oid :
   -- authenticator/postgres/supabase_realtime_admin membres des rôles clients
   -- sont des attributions système ENTRANTES et ne doivent pas être modifiées.
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid) THEN
     RAISE EXCEPTION 'Appartenance sortante de % : audit INHERIT/SET requis',r.rolname; END IF;
   IF pg_catalog.has_schema_privilege(r.oid,'public','CREATE') OR pg_catalog.has_schema_privilege(r.oid,'auth','CREATE') THEN
     RAISE WARNING 'CREATE sur un schéma sensible pour % : correction distincte à examiner avant administration',r.rolname; END IF;
 END LOOP;
END $effective$;

-- Version persistante DISTINCTE : les fichiers de revue gardent ROLLBACK.
COMMIT;
