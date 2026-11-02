-- SHENA-STAGING UNIQUEMENT — PROPOSITION NON EXÉCUTÉE.
-- Prérequis : helper admin corrigé ; examiner toutes les politiques Storage existantes.
-- Aucune conversion d'un bucket existant ni copie d'objets Production.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF current_setting('shena.review_context',true) IS DISTINCT FROM 'staging-reviewed' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Cible et opérateur staging requis'; END IF;
 IF to_regprocedure('public.shena_is_admin()') IS NULL THEN RAISE EXCEPTION 'Helper administrateur requis'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'RLS Storage doit déjà être active'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id IN('product-images','digital-quarantine','digital-products')) THEN RAISE EXCEPTION 'Bucket déjà présent : examiner, ne pas écraser'; END IF;
 -- Arrêt conservateur : une ancienne politique permissive pourrait ouvrir nos buckets.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass) THEN RAISE EXCEPTION 'Politiques Storage existantes à auditer séparément'; END IF;
END $guard$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('product-images','product-images',true,2097152,ARRAY['image/webp']),
 ('digital-quarantine','digital-quarantine',false,2097152,ARRAY['application/pdf']),
 ('digital-products','digital-products',false,104857600,ARRAY['application/pdf']);
CREATE POLICY shena_staging_images_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='product-images' AND (SELECT public.shena_is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY shena_staging_images_select ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='product-images' AND (SELECT public.shena_is_admin()));
CREATE POLICY shena_staging_quarantine_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='digital-quarantine' AND (SELECT public.shena_is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY shena_staging_private_select ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id IN('digital-quarantine','digital-products') AND (SELECT public.shena_is_admin()));
-- Aucun INSERT client dans digital-products : analyse/transfert futur séparé.
-- Aucun DELETE, UPDATE, politique d'achat client ou lien signé payant.
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
CREATE POLICY shena_staging_assets_read ON public.digital_assets FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY shena_staging_assets_insert ON public.digital_assets FOR INSERT TO authenticated WITH CHECK((SELECT public.shena_is_admin()));
-- Les caps admin ne sont PAS modifiées automatiquement. Après recette, préparer
-- l'adaptation revue du manifeste pour annoncer images/digital en staging seulement.
-- SHENA_STORAGE_STAGING_TESTS_HERE
ROLLBACK;
