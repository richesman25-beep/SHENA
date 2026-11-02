-- SHENA-STAGING SEULEMENT. PROPOSITION NON EXÉCUTÉE.
-- Après recette du script 02 et examen des politiques : annonce des capacités,
-- pas de nouveau privilège, pas de fichier ni bucket supplémentaire.
BEGIN;
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('shena.review_context',true) IS DISTINCT FROM 'staging-reviewed' THEN RAISE EXCEPTION 'Opérateur et cible staging requis'; END IF;
 IF (SELECT count(*) FROM storage.buckets WHERE (id='product-images' AND public) OR(id IN('digital-quarantine','digital-products') AND NOT public))<>3 THEN RAISE EXCEPTION 'Visibilité des buckets non conforme'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.digital_assets'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'RLS requise'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass)<>4
 OR (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname IN('shena_staging_images_insert','shena_staging_images_select','shena_staging_quarantine_insert','shena_staging_private_select'))<>4 THEN RAISE EXCEPTION 'Politiques Storage différentes : nouvel audit requis'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.shena_admin_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('version',1,'products',true,'categories',false,'images',true,'digital',true,'geography',false);
END $$;
ALTER FUNCTION public.shena_admin_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_admin_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_admin_status() TO authenticated;
ROLLBACK;
