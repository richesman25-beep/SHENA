-- INVENTAIRE PRÉPARÉ NON EXÉCUTÉ. Métadonnées potentiellement confidentielles.
-- Opérateur habilité : résultats complets nécessaires, pas une session anon.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT current_user,current_database(),current_setting('server_version');
SELECT c.relname,c.relkind,c.relowner::regrole,c.relrowsecurity,c.relforcerowsecurity,
 c.relacl FROM pg_catalog.pg_class c WHERE c.oid='public.products'::regclass;
SELECT a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) AS exact_type,
 a.attnotnull,a.attidentity,a.attgenerated,a.attacl,
 pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.products'::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;
SELECT conname,contype,convalidated,pg_catalog.pg_get_constraintdef(oid) AS definition
 FROM pg_catalog.pg_constraint WHERE conrelid='public.products'::regclass ORDER BY conname;
SELECT polname,polcmd,polpermissive,polroles,
 pg_catalog.pg_get_expr(polqual,polrelid) AS using_expression,
 pg_catalog.pg_get_expr(polwithcheck,polrelid) AS check_expression
 FROM pg_catalog.pg_policy WHERE polrelid='public.products'::regclass ORDER BY polname;
SELECT c.relname,a.grantee,a.grantor,a.privilege_type,a.is_grantable
 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
 WHERE c.oid='public.products'::regclass;
SELECT c.attname,a.grantee,a.grantor,a.privilege_type,a.is_grantable
 FROM pg_catalog.pg_attribute c CROSS JOIN LATERAL pg_catalog.aclexplode(c.attacl) a
 WHERE c.attrelid='public.products'::regclass AND c.attnum>0;
SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,r.rolinherit,r.rolcanlogin,
 pg_catalog.has_schema_privilege(r.oid,'public','CREATE') AS can_create_public,
 pg_catalog.has_schema_privilege(r.oid,'auth','CREATE') AS can_create_auth,
 pg_catalog.has_column_privilege(r.oid,'auth.users','raw_app_meta_data','UPDATE') AS can_change_admin_role,
 pg_catalog.has_column_privilege(r.oid,'public.products','price_htg','UPDATE') AS can_update_price_acl,
 pg_catalog.has_table_privilege(r.oid,'public.products','TRUNCATE') AS can_truncate
 FROM pg_catalog.pg_roles r WHERE r.rolname IN('anon','authenticated');
-- Membres directs de ces rôles et rôles auxquels ils peuvent appartenir.
-- Une appartenance sortante est refusée par la proposition jusqu'à revue complète.
SELECT roleid::regrole,member::regrole,grantor::regrole,admin_option FROM pg_catalog.pg_auth_members
 WHERE member IN('anon'::regrole,'authenticated'::regrole) OR roleid IN('anon'::regrole,'authenticated'::regrole);
SELECT tgname,pg_catalog.pg_get_triggerdef(oid) AS definition FROM pg_catalog.pg_trigger
 WHERE tgrelid='public.products'::regclass AND NOT tgisinternal;
SELECT rulename,pg_catalog.pg_get_ruledef(oid) AS definition FROM pg_catalog.pg_rewrite
 WHERE ev_class='public.products'::regclass;
-- Toutes les fonctions public SECURITY DEFINER : examiner aussi les RPC existantes,
-- qui pourraient contourner RLS indépendamment de cette nouvelle proposition.
-- Leur corps peut contenir des secrets historiques : ne pas publier les résultats bruts.
SELECT p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS client_execute,
 pg_catalog.pg_get_functiondef(p.oid) AS definition
 FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef AND p.prokind IN('f','p');
-- Agrégats uniquement, pas de noms/descriptions/images/utilisateurs.
-- À utiliser après confirmation des types ; aucune correction automatique.
SELECT count(*) AS total,
 count(*) FILTER(WHERE price_htg IS NULL OR price_htg::text IN('NaN','Infinity','-Infinity') OR price_htg<0 OR price_htg>100000000 OR price_htg<>round(price_htg::numeric,2)) AS invalid_price,
 count(*) FILTER(WHERE stock IS NULL OR stock<0 OR stock>1000000 OR stock<>trunc(stock::numeric)) AS invalid_stock,
 count(*) FILTER(WHERE active IS NULL OR created_at IS NULL OR name IS NULL OR length(btrim(name)) NOT BETWEEN 1 AND 160 OR length(description)>15000) AS invalid_required
 FROM public.products;
SELECT product_type,count(*) AS products,min(stock) AS min_stock,max(stock) AS max_stock
 FROM public.products GROUP BY product_type ORDER BY product_type;
ROLLBACK;
