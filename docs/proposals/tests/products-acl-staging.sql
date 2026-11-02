-- TESTS PRÉPARÉS, NON EXÉCUTÉS. STAGING UNIQUEMENT, avant la migration admin.
-- Insérer au marqueur du correctif, dans la MÊME transaction avec ROLLBACK final.
-- Aucun produit ni compte créé/modifié. Tests DML à zéro ligne.
-- Le test TRUNCATE réel est précédé d'un refus ACL obligatoire, sans CASCADE.
-- Ne JAMAIS exécuter ce protocole sur Production.
DO $stage$
BEGIN
 IF current_setting('shena.review_context',true) IS DISTINCT FROM 'staging-reviewed' THEN
   RAISE EXCEPTION 'Protocole de test limité au staging identifié par l opérateur'; END IF;
END $stage$;
SET LOCAL ROLE anon;
DO $anon$
BEGIN
 IF pg_catalog.has_table_privilege(current_user,'public.products','MAINTAIN')
    OR pg_catalog.has_table_privilege(current_user,'public.products','TRUNCATE')
    OR pg_catalog.has_any_column_privilege(current_user,'public.products','INSERT')
    OR pg_catalog.has_any_column_privilege(current_user,'public.products','UPDATE')
    OR pg_catalog.has_table_privilege(current_user,'public.products','DELETE') THEN
   RAISE EXCEPTION 'Droit dangereux présent : aucun essai destructif autorisé'; END IF;
 BEGIN
   TRUNCATE TABLE public.products;
   RAISE EXCEPTION 'ÉCHEC : TRUNCATE autorisé, arrêt et annulation de la transaction';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.products(name) SELECT name FROM public.products WHERE false;
   RAISE EXCEPTION 'ÉCHEC : INSERT autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.products SET active=active WHERE false;
   RAISE EXCEPTION 'ÉCHEC : UPDATE autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   DELETE FROM public.products WHERE false;
   RAISE EXCEPTION 'ÉCHEC : DELETE autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM id FROM public.products LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.products WHERE active IS NOT TRUE) THEN
   RAISE EXCEPTION 'Visibilité publique des inactifs'; END IF;
 RAISE NOTICE 'PASS anon : SELECT disponible ; TRUNCATE/INSERT/UPDATE/DELETE refusés (42501)';
END $anon$;
RESET ROLE;
-- Simule un utilisateur ordinaire sans sub : refus ACL indépendant du compte/JWT.
-- La recette Auth/REST avec un vrai client reste un contrôle complémentaire distinct.
SET LOCAL ROLE authenticated;
DO $client$
BEGIN
 IF pg_catalog.has_table_privilege(current_user,'public.products','MAINTAIN')
    OR pg_catalog.has_table_privilege(current_user,'public.products','TRUNCATE')
    OR pg_catalog.has_any_column_privilege(current_user,'public.products','INSERT')
    OR pg_catalog.has_any_column_privilege(current_user,'public.products','UPDATE')
    OR pg_catalog.has_table_privilege(current_user,'public.products','DELETE') THEN
   RAISE EXCEPTION 'Droit dangereux présent : aucun essai destructif autorisé'; END IF;
 BEGIN
   TRUNCATE TABLE public.products;
   RAISE EXCEPTION 'ÉCHEC : TRUNCATE autorisé, arrêt et annulation de la transaction';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.products(name) SELECT name FROM public.products WHERE false;
   RAISE EXCEPTION 'ÉCHEC : INSERT autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.products SET active=active WHERE false;
   RAISE EXCEPTION 'ÉCHEC : UPDATE autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   DELETE FROM public.products WHERE false;
   RAISE EXCEPTION 'ÉCHEC : DELETE autorisé';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM id FROM public.products LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.products WHERE active IS NOT TRUE) THEN
   RAISE EXCEPTION 'Visibilité client des inactifs'; END IF;
 RAISE NOTICE 'PASS authenticated : SELECT disponible ; TRUNCATE/INSERT/UPDATE/DELETE refusés (42501)';
END $client$;
RESET ROLE;
-- Le ROLLBACK du fichier parent doit suivre. Aucun COMMIT ici.
