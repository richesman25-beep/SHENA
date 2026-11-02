-- LECTURE SEULE : aucun secret, mot de passe ou contenu client.
SELECT current_database(), version();
SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN('public','storage') ORDER BY schemaname,tablename,policyname;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id IN('product-images','digital-quarantine','digital-products');
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'shena_%';
SELECT conrelid::regclass,conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace;
SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN('anon','authenticated');
-- Comparer ces résultats aux propositions avant toute adaptation/exécution.
