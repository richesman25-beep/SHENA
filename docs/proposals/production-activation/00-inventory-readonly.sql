-- INVENTAIRE PRODUCTION EN LECTURE SEULE. Aucune sauvegarde ne résulte de ce SQL.
-- Les définitions peuvent contenir des secrets : sortie privée hors Git, jamais de dump dans les logs.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT current_user,current_database(),current_setting('server_version');
SELECT c.relname,c.relowner::regrole,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN('r','p') ORDER BY c.relname;
SELECT a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
 pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attacl
 FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.products'::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;
SELECT conname,contype,convalidated,pg_catalog.pg_get_constraintdef(oid) FROM pg_catalog.pg_constraint WHERE conrelid='public.products'::regclass;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
 WHERE (schemaname='public') OR (schemaname='storage' AND tablename IN('objects','buckets')) ORDER BY schemaname,tablename,policyname;
SELECT r.rolname,r.rolsuper,r.rolbypassrls,
 pg_catalog.has_table_privilege(r.oid,'public.products','SELECT') AS can_select,
 pg_catalog.has_table_privilege(r.oid,'public.products','TRUNCATE') AS can_truncate,
 pg_catalog.has_any_column_privilege(r.oid,'public.products','INSERT') AS can_insert,
 pg_catalog.has_any_column_privilege(r.oid,'public.products','UPDATE') AS can_update,
 pg_catalog.has_table_privilege(r.oid,'public.products','DELETE') AS can_delete,
 pg_catalog.has_schema_privilege(r.oid,'public','CREATE') AS can_create_public,
 pg_catalog.has_schema_privilege(r.oid,'auth','CREATE') AS can_create_auth
 FROM pg_catalog.pg_roles r WHERE rolname IN('anon','authenticated');
SELECT roleid::regrole,member::regrole,grantor::regrole,admin_option,to_jsonb(m)->>'inherit_option' AS inherit_option,to_jsonb(m)->>'set_option' AS set_option FROM pg_catalog.pg_auth_members m;
SELECT n.nspname,p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proconfig,p.proacl,pg_catalog.pg_get_functiondef(p.oid) AS private_function_definition
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind IN('f','p') AND n.nspname='public';
SELECT c.relname,a.attname,a.attacl FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid WHERE c.oid IN('storage.objects'::regclass,'storage.buckets'::regclass) AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL;
SELECT c.relname,c.relowner::regrole,c.relrowsecurity,c.relacl FROM pg_catalog.pg_class c WHERE oid IN('storage.objects'::regclass,'storage.buckets'::regclass);
SELECT extname,extversion FROM pg_catalog.pg_extension;
SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;
SELECT bucket_id,count(*) AS object_count FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
SELECT id,email,email_confirmed_at,raw_app_meta_data->'shena_role' AS role_server,raw_user_meta_data->'shena_role' AS role_client_untrusted FROM auth.users WHERE raw_app_meta_data->'shena_role'='"admin"'::jsonb OR raw_user_meta_data->'shena_role'='"admin"'::jsonb;
SELECT count(*) AS users_total,count(*) FILTER(WHERE raw_app_meta_data->'shena_role'='"admin"'::jsonb) AS all_admins,count(*) FILTER(WHERE email_confirmed_at IS NOT NULL AND raw_app_meta_data->'shena_role'='"admin"'::jsonb) AS verified_admins FROM auth.users;
ROLLBACK;
