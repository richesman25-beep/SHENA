-- PROPOSITION PRODUCTION NON EXÉCUTÉE. Conserve le bucket et les images existantes.
-- Les politiques restrictives protègent les nouveaux buckets même si une ancienne
-- politique permissive est large. Aucun UPDATE/DELETE client des objets concernés.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Production, opérateur et restauration vérifiés requis'; END IF;
 IF to_regprocedure('public.shena_is_admin()') IS NULL THEN RAISE EXCEPTION 'Administration sécurisée requise'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class WHERE oid IN('storage.objects'::regclass,'storage.buckets'::regclass) AND relrowsecurity AND relowner NOT IN('anon'::regrole,'authenticated'::regrole))<>2 THEN RAISE EXCEPTION 'RLS Storage active et propriétaire non client requis'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN(VALUES('storage.objects'),('storage.buckets')) t(name) WHERE r.rolname IN('anon','authenticated') AND (pg_catalog.has_table_privilege(r.oid,t.name,'TRUNCATE') OR pg_catalog.has_table_privilege(r.oid,t.name,'TRIGGER') OR pg_catalog.has_table_privilege(r.oid,t.name,'MAINTAIN'))) THEN RAISE EXCEPTION 'ACL natives Storage dangereuses : audit et correctif séparé requis avant installation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='product-images' AND public) THEN RAISE EXCEPTION 'Bucket public existant product-images attendu : audit avant adaptation'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id IN('digital-quarantine','digital-products')) OR to_regclass('public.digital_assets') IS NOT NULL THEN RAISE EXCEPTION 'Objets numériques déjà présents : ne pas remplacer, examiner'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.shena_admin_status()') AND NOT prosecdef AND proowner='postgres'::regrole AND pg_catalog.md5(prosrc)='98941105133c62138283a769944f2ae1') THEN RAISE EXCEPTION 'Manifeste administrateur modifié : examen requis avant remplacement'; END IF;
END $guard$;
-- Visibilité, taille et objets existants de product-images inchangés.
-- WebP ajouté sans retirer JPEG/autres MIME existants, pour le réencodage sécurisé de l’application.
UPDATE storage.buckets SET allowed_mime_types=array_append(allowed_mime_types,'image/webp')
 WHERE id='product-images' AND allowed_mime_types IS NOT NULL
 AND NOT('image/webp'=ANY(allowed_mime_types) OR 'image/*'=ANY(allowed_mime_types) OR '*/*'=ANY(allowed_mime_types));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('digital-quarantine','digital-quarantine',false,2097152,ARRAY['application/pdf']),
 ('digital-products','digital-products',false,104857600,ARRAY['application/pdf']);
-- Exposer seulement le booléen d'identité propre au client, jamais une identité arbitraire.
-- Le helper admin principal reste non exécutable par anon.
CREATE FUNCTION public.shena_storage_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND public.shena_is_admin()
$$;
ALTER FUNCTION public.shena_storage_is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_storage_is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_storage_is_admin() TO anon,authenticated;
CREATE FUNCTION public.shena_can_download(p_bucket text,p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$ SELECT false $$;
ALTER FUNCTION public.shena_can_download(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_can_download(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_can_download(text,text) TO anon,authenticated;
CREATE POLICY shena_prod_bucket_update_guard ON storage.buckets AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(id NOT IN('product-images','digital-quarantine','digital-products')) WITH CHECK(id NOT IN('product-images','digital-quarantine','digital-products'));
CREATE POLICY shena_prod_bucket_delete_guard ON storage.buckets AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(id NOT IN('product-images','digital-quarantine','digital-products'));
CREATE POLICY shena_prod_bucket_insert_guard ON storage.buckets AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(id NOT IN('product-images','digital-quarantine','digital-products'));
CREATE POLICY shena_prod_private_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id NOT IN('digital-quarantine','digital-products') OR (SELECT public.shena_storage_is_admin()) OR public.shena_can_download(bucket_id,name));
CREATE POLICY shena_prod_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id NOT IN('product-images','digital-quarantine','digital-products') OR ((SELECT public.shena_storage_is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text));
CREATE POLICY shena_prod_object_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id NOT IN('product-images','digital-quarantine','digital-products'))
 WITH CHECK(bucket_id NOT IN('product-images','digital-quarantine','digital-products'));
CREATE POLICY shena_prod_object_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(bucket_id NOT IN('product-images','digital-quarantine','digital-products'));
CREATE POLICY shena_prod_admin_object_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id IN('product-images','digital-quarantine','digital-products') AND (SELECT public.shena_storage_is_admin()));
CREATE POLICY shena_prod_admin_object_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id IN('product-images','digital-quarantine','digital-products') AND (SELECT public.shena_storage_is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE TABLE public.digital_assets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES public.products(id),
 bucket text NOT NULL CHECK(bucket='digital-quarantine'),object_path text NOT NULL UNIQUE,
 original_name text NOT NULL CHECK(length(original_name)<=200),mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 2097152),status text NOT NULL DEFAULT 'quarantine' CHECK(status IN('quarantine','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.digital_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.digital_assets TO authenticated;
CREATE POLICY shena_prod_assets_read ON public.digital_assets FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY shena_prod_assets_insert ON public.digital_assets FOR INSERT TO authenticated WITH CHECK((SELECT public.shena_is_admin()));
CREATE OR REPLACE FUNCTION public.shena_admin_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('version',1,'products',true,'categories',false,'images',true,'digital',true,'geography',false);
END $$;
ALTER FUNCTION public.shena_admin_status() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_admin_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_admin_status() TO authenticated;
-- Aucun droit de lecture client sur un fichier privé à ce stade.
ROLLBACK;
