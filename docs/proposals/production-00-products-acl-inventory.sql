-- INVENTAIRE ACL PRÉPARÉ, NON EXÉCUTÉ. Lecture seule, métadonnées sensibles.
-- Réaliser séparément par un opérateur autorisé ; ne pas publier les corps bruts.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT current_user,current_database(),current_setting('server_version');
SELECT c.relowner::regrole,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM pg_catalog.pg_class c WHERE c.oid='public.products'::regclass;
-- ACL brutes, grantor et grant option : indispensables à un retour arrière exact.
SELECT c.relacl FROM pg_catalog.pg_class c WHERE c.oid='public.products'::regclass;
SELECT attname,attacl FROM pg_catalog.pg_attribute
 WHERE attrelid='public.products'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum;
SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
 a.grantor::regrole,a.privilege_type,a.is_grantable
 FROM pg_catalog.pg_class c CROSS JOIN LATERAL
 pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
 WHERE c.oid='public.products'::regclass ORDER BY 1,3;
SELECT c.attname,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
 a.grantor::regrole,a.privilege_type,a.is_grantable
 FROM pg_catalog.pg_attribute c CROSS JOIN LATERAL pg_catalog.aclexplode(c.attacl) a
 WHERE c.attrelid='public.products'::regclass AND c.attnum>0 AND NOT c.attisdropped ORDER BY 1,2,4;
SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcanlogin,r.rolcreaterole,r.rolinherit,
 pg_catalog.has_table_privilege(r.oid,'public.products','SELECT') AS select_acl,
 pg_catalog.has_table_privilege(r.oid,'public.products','INSERT') AS insert_table,
 pg_catalog.has_any_column_privilege(r.oid,'public.products','INSERT') AS insert_any_column,
 pg_catalog.has_table_privilege(r.oid,'public.products','UPDATE') AS update_table,
 pg_catalog.has_any_column_privilege(r.oid,'public.products','UPDATE') AS update_any_column,
 pg_catalog.has_table_privilege(r.oid,'public.products','DELETE') AS delete_acl,
 pg_catalog.has_table_privilege(r.oid,'public.products','TRUNCATE') AS truncate_acl,
 pg_catalog.has_table_privilege(r.oid,'public.products','TRIGGER') AS trigger_acl,
 pg_catalog.has_any_column_privilege(r.oid,'public.products','REFERENCES') AS references_any_column,
 pg_catalog.has_schema_privilege(r.oid,'public','CREATE') AS create_public
 FROM pg_catalog.pg_roles r WHERE rolname IN('anon','authenticated');
-- Toutes les appartenances atteignables, y compris sans héritage automatique.
-- USAGE = droits immédiatement hérités ; les chemins MEMBER sont aussi à examiner
-- pour SET ROLE. Les options SET/INHERIT n'existent pas sur toutes les versions PG.
WITH RECURSIVE memberships(root,role_oid,path) AS (
 SELECT oid,oid,ARRAY[oid] FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated')
 UNION ALL
 SELECT p.root,m.roleid,p.path||m.roleid FROM memberships p
 JOIN pg_catalog.pg_auth_members m ON m.member=p.role_oid WHERE NOT m.roleid=ANY(p.path)
)
SELECT root::regrole AS client_role,role_oid::regrole AS reachable_role,path,
 pg_catalog.pg_has_role(root,role_oid,'USAGE') AS immediately_inherited,
 pg_catalog.pg_has_role(root,role_oid,'MEMBER') AS membership,
 pg_catalog.has_table_privilege(role_oid,'public.products','TRUNCATE') AS role_can_truncate
 FROM memberships ORDER BY 1,2;
SELECT roleid::regrole,member::regrole,grantor::regrole,admin_option,
 to_jsonb(m)->>'inherit_option' AS inherit_option,to_jsonb(m)->>'set_option' AS set_option
 FROM pg_catalog.pg_auth_members m ORDER BY roleid,member;
SELECT polname,polcmd,polpermissive,polroles,
 pg_catalog.pg_get_expr(polqual,polrelid) AS using_expression,
 pg_catalog.pg_get_expr(polwithcheck,polrelid) AS check_expression
 FROM pg_catalog.pg_policy WHERE polrelid='public.products'::regclass ORDER BY polname;
-- Toutes les fonctions/routines des schémas applicatifs : ne pas rechercher seulement
-- le mot TRUNCATE ; SQL dynamique, appels transitifs et extensions peuvent le masquer.
SELECT n.nspname,p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS client_execute,
 pg_catalog.pg_get_functiondef(p.oid) AS definition
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN('pg_catalog','information_schema')
 AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
 AND p.prokind IN('f','p') AND (p.prosecdef OR n.nspname='public') ORDER BY 1,2;
SELECT tgname,pg_catalog.pg_get_triggerdef(oid) FROM pg_catalog.pg_trigger
 WHERE tgrelid='public.products'::regclass AND NOT tgisinternal;
SELECT schemaname,viewname,viewowner,definition FROM pg_catalog.pg_views
 WHERE schemaname='public';
-- Les droits par défaut peuvent rouvrir les FUTURES tables après leur création.
SELECT defaclrole::regrole,defaclnamespace,defaclobjtype,defaclacl FROM pg_catalog.pg_default_acl;
ROLLBACK;
