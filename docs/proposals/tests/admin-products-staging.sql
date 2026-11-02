-- TESTS PRÉPARÉS, NON EXÉCUTÉS. À insérer au marqueur de la proposition corrigée.
-- Trois comptes RÉELS du staging uniquement ; aucune création ni promotion ici.
-- PostgreSQL postgres simule les rôles SQL pour tester RLS, pas la signature JWT.
-- Tous les produits de test et modifications temporaires sont annulés par ROLLBACK.
DO $accounts$
DECLARE c uuid := current_setting('shena.test_client_id')::uuid;
 a uuid := current_setting('shena.test_admin_a_id')::uuid;
 b uuid := current_setting('shena.test_admin_b_id')::uuid;
BEGIN
 IF c=a OR c=b OR a=b THEN RAISE EXCEPTION 'Trois comptes distincts requis'; END IF;
 IF (SELECT count(*) FROM auth.users WHERE id IN(c,a,b) AND email_confirmed_at IS NOT NULL)<>3 THEN
   RAISE EXCEPTION 'Trois comptes staging existants et emails vérifiés requis'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=c AND raw_app_meta_data->'shena_role'='"admin"'::jsonb)
 OR (SELECT count(*) FROM auth.users WHERE id IN(a,b) AND raw_app_meta_data->'shena_role'='"admin"'::jsonb)<>2 THEN
   RAISE EXCEPTION 'Un client sans rôle et deux administrateurs déjà vérifiés requis'; END IF;
 IF NOT pg_catalog.has_column_privilege('authenticated','public.products','price_htg','UPDATE')
    OR pg_catalog.has_column_privilege('anon','public.products','price_htg','UPDATE')
    OR pg_catalog.has_column_privilege('authenticated','public.products','id','UPDATE')
    OR pg_catalog.has_column_privilege('authenticated','public.products','created_at','UPDATE')
    OR pg_catalog.has_table_privilege('authenticated','public.products','TRUNCATE')
    OR pg_catalog.has_table_privilege('anon','public.products','TRUNCATE')
    OR pg_catalog.has_table_privilege('authenticated','public.products','DELETE') THEN
   RAISE EXCEPTION 'ACL finales inattendues'; END IF;
END $accounts$;
-- Identifiants uniques dans cette transaction, jamais des identifiants production codés.
SELECT set_config('shena.test_active_id',gen_random_uuid()::text,true);
SELECT set_config('shena.test_inactive_id',gen_random_uuid()::text,true);
INSERT INTO public.products(id,created_at,name,description,price_htg,product_type,stock,image_url,active) VALUES
 (current_setting('shena.test_active_id')::uuid,now(),'SHENA STAGING actif','Fixture annulée',10,'physical',2,NULL,true),
 (current_setting('shena.test_inactive_id')::uuid,now(),'SHENA STAGING inactif','Fixture annulée',10,'physical',2,NULL,false);

SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','anon',true);
SET LOCAL ROLE anon;
DO $anonymous$
DECLARE n integer;
BEGIN
 IF (SELECT count(*) FROM public.products WHERE id=current_setting('shena.test_active_id')::uuid)<>1
 OR EXISTS(SELECT 1 FROM public.products WHERE active IS NOT TRUE) THEN RAISE EXCEPTION 'Visibilité anonyme incorrecte'; END IF;
 BEGIN
   INSERT INTO public.products(id,created_at,name,description,price_htg,product_type,stock,active) VALUES(gen_random_uuid(),now(),'Interdit','',1,'physical',1,true);
   RAISE EXCEPTION 'INSERT anonyme autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.products SET active=false WHERE id=current_setting('shena.test_active_id')::uuid;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>0 THEN RAISE EXCEPTION 'UPDATE anonyme effectif'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.shena_admin_status(); RAISE EXCEPTION 'RPC admin accessible anonyme';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.shena_is_admin(); RAISE EXCEPTION 'Helper admin accessible anonyme';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS anonymous: actifs seulement ; INSERT/UPDATE/RPC refusés';
END $anonymous$;
RESET ROLE;

-- Faux rôle dans user_metadata persistées, app_metadata DB inchangées.
UPDATE auth.users SET raw_user_meta_data=COALESCE(raw_user_meta_data,'{}'::jsonb)||'{"shena_role":"admin"}'::jsonb
 WHERE id=current_setting('shena.test_client_id')::uuid;
SELECT set_config('request.jwt.claim.sub',current_setting('shena.test_client_id'),true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
-- Même un claim app_metadata forgé par l'opérateur de test ne doit pas compter.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shena.test_client_id'),'role','authenticated',
 'user_metadata',jsonb_build_object('shena_role','admin'),'app_metadata',jsonb_build_object('shena_role','admin'))::text,true);
SET LOCAL ROLE authenticated;
DO $client$
DECLARE n integer;
BEGIN
 IF public.shena_is_admin() THEN RAISE EXCEPTION 'Élévation par métadonnées/JWT'; END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE active IS NOT TRUE)
 OR (SELECT count(*) FROM public.products WHERE id=current_setting('shena.test_active_id')::uuid)<>1 THEN
   RAISE EXCEPTION 'Visibilité client incorrecte'; END IF;
 BEGIN
   INSERT INTO public.products(id,created_at,name,description,price_htg,product_type,stock,active) VALUES(gen_random_uuid(),now(),'Interdit','',1,'physical',1,true);
   RAISE EXCEPTION 'INSERT client autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.products SET price_htg=999,active=false WHERE id=current_setting('shena.test_active_id')::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Client a modifié/dépublié un produit actif'; END IF;
 UPDATE public.products SET active=true WHERE id=current_setting('shena.test_inactive_id')::uuid;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Client a modifié un produit inactif'; END IF;
 BEGIN
   PERFORM public.shena_admin_status(); RAISE EXCEPTION 'RPC admin autorisée au client';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS client: pas de rôle via user_metadata ou claims ; écritures sans effet';
END $client$;
RESET ROLE;

-- Test de chacun des deux fondateurs dans la même session, rôle SQL non propriétaire.
SELECT set_config('request.jwt.claim.sub',current_setting('shena.test_admin_a_id'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shena.test_admin_a_id'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $admin_a$
DECLARE pid uuid:=gen_random_uuid(); n integer;
BEGIN
 IF NOT public.shena_is_admin() OR public.shena_admin_status()->'products'<>'true'::jsonb THEN RAISE EXCEPTION 'Admin A refusé'; END IF;
 IF (SELECT count(*) FROM public.products WHERE id IN(current_setting('shena.test_active_id')::uuid,current_setting('shena.test_inactive_id')::uuid))<>2 THEN
   RAISE EXCEPTION 'Admin A ne lit pas les deux états'; END IF;
 INSERT INTO public.products(id,created_at,name,description,price_htg,product_type,stock,active) VALUES(pid,now(),'SHENA STAGING admin A','',15.50,'physical',3,true);
 UPDATE public.products SET price_htg=20,stock=4 WHERE id=pid;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Édition admin A incorrecte'; END IF;
 UPDATE public.products SET active=false WHERE id=pid;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=pid AND NOT active AND price_htg=20 AND stock=4) THEN RAISE EXCEPTION 'Dépublication admin A incorrecte'; END IF;
 -- Même admin : pas de DELETE, TRUNCATE, réécriture identité/horodatage.
 BEGIN DELETE FROM public.products WHERE id=pid; RAISE EXCEPTION 'DELETE accordé'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.products SET id=gen_random_uuid() WHERE id=pid; RAISE EXCEPTION 'Identité modifiable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Prix négatif, fraction excessive, NaN, dépassement ; stocks et types invalides.
 BEGIN UPDATE public.products SET price_htg=-1 WHERE id=pid; RAISE EXCEPTION 'Prix négatif accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET price_htg=1.234 WHERE id=pid; RAISE EXCEPTION 'Trois décimales acceptées'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET price_htg='NaN'::numeric WHERE id=pid; RAISE EXCEPTION 'NaN accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET price_htg=100000001 WHERE id=pid; RAISE EXCEPTION 'Prix trop élevé accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET stock=-1 WHERE id=pid; RAISE EXCEPTION 'Stock négatif accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET stock=1000001 WHERE id=pid; RAISE EXCEPTION 'Stock trop élevé accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET stock=NULL WHERE id=pid; RAISE EXCEPTION 'Stock NULL accepté'; EXCEPTION WHEN check_violation OR not_null_violation THEN NULL; END;
 BEGIN UPDATE public.products SET product_type='arbitrary' WHERE id=pid; RAISE EXCEPTION 'Type arbitraire accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.products SET product_type='digital',stock=4 WHERE id=pid; RAISE EXCEPTION 'Stock digital accepté'; EXCEPTION WHEN check_violation THEN NULL; END;
 RAISE NOTICE 'PASS admin A: CRUD sans DELETE, dépublication, bornes prix/stock/types';
END $admin_a$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('shena.test_admin_b_id'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shena.test_admin_b_id'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $admin_b$
DECLARE pid uuid:=gen_random_uuid(); n integer;
BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Admin B refusé'; END IF;
 INSERT INTO public.products(id,created_at,name,description,price_htg,product_type,stock,active) VALUES(pid,now(),'SHENA STAGING admin B','',15,'digital',0,true);
 UPDATE public.products SET name='SHENA STAGING admin B édité',price_htg=16 WHERE id=pid;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Édition admin B incorrecte'; END IF;
 UPDATE public.products SET active=false WHERE id=pid;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=pid AND NOT active AND price_htg=16) THEN RAISE EXCEPTION 'Dépublication admin B incorrecte'; END IF;
 RAISE NOTICE 'PASS admin B: création/édition/dépublication numérique';
END $admin_b$;
RESET ROLE;

-- Révocation relue en base malgré les claims existants. Changement TEMPORAIRE staging.
UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data-'shena_role' WHERE id=current_setting('shena.test_admin_b_id')::uuid;
SET LOCAL ROLE authenticated;
DO $revoked$
DECLARE n integer;
BEGIN
 IF public.shena_is_admin() THEN RAISE EXCEPTION 'Rôle révoqué encore accepté'; END IF;
 UPDATE public.products SET active=false WHERE id=current_setting('shena.test_active_id')::uuid;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Rôle révoqué a écrit'; END IF;
 RAISE NOTICE 'PASS rôle révoqué : pas de nouvelle écriture';
END $revoked$;
RESET ROLE;
-- ROLLBACK du fichier principal suit obligatoirement. Aucun fichier de test ne COMMIT.
