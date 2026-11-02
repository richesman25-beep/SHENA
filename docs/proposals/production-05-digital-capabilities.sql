-- PROPOSITION NON EXÉCUTÉE. Dépend de 01 à 04. Examiner le préflight avant application.
BEGIN;
CREATE TABLE public.digital_product_details (
 product_id uuid PRIMARY KEY REFERENCES public.products(id),
 kind text NOT NULL CHECK(kind IN('ebook','document','template','graphics','software','training','planner','other')),
 formats text[] NOT NULL DEFAULT '{}' CHECK(cardinality(formats)<=10),
 license text NOT NULL DEFAULT '' CHECK(length(license)<=5000),
 compatibility text NOT NULL DEFAULT '' CHECK(length(compatibility)<=3000),
 contents text NOT NULL DEFAULT '' CHECK(length(contents)<=15000)
);
ALTER TABLE public.digital_product_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_product_details FROM anon,authenticated;
GRANT SELECT ON public.digital_product_details TO anon,authenticated;
GRANT INSERT,UPDATE ON public.digital_product_details TO authenticated;
CREATE POLICY shena_digital_details_public ON public.digital_product_details FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.active AND lower(p.product_type) IN('digital','numerique','numérique','ebook','template')));
CREATE POLICY shena_digital_details_admin ON public.digital_product_details TO authenticated USING((SELECT public.shena_is_admin())) WITH CHECK((SELECT public.shena_is_admin()) AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND lower(p.product_type) IN('digital','numerique','numérique','ebook','template')));
-- Garder les fichiers au format PDF uniquement dans cette phase. Les ZIP/Office/EPUB
-- restent refusés par le manifeste jusqu'à examen antivirus/contraintes Storage.
-- digitalMetadata permet les métadonnées ; extendedDigitalUploads est distinct.
CREATE OR REPLACE FUNCTION public.shena_admin_status() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('version',2,
 'products',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='shena_admin_products_update'),
 'categories',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='shena_categories_admin'),
 'categoryLinks',to_regprocedure('public.shena_remove_product_category(uuid,uuid)') IS NOT NULL,
 'images',EXISTS(SELECT 1 FROM storage.buckets WHERE id='product-images' AND public=true) AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='shena_images_admin_insert'),
 'mediaManage',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='shena_managed_images_insert') AND to_regprocedure('public.shena_register_product_image(uuid,text,text,bigint)') IS NOT NULL,
 -- Activation de la suppression volontairement différée : audit manuel des politiques
 -- permissives combinées, Storage et références externes requis, jamais un simple flag UI.
 'mediaDelete',false,
 'audit',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_audit' AND policyname='shena_audit_admin_read'),
 'digitalMetadata',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='digital_product_details' AND policyname='shena_digital_details_admin'),
 'extendedDigitalUploads',false,
 'digital',EXISTS(SELECT 1 FROM storage.buckets WHERE id='digital-quarantine' AND public=false) AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='digital_assets' AND policyname='shena_assets_admin'),
 'geography',false);
 END $$;
REVOKE ALL ON FUNCTION public.shena_admin_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shena_admin_status() TO authenticated;
ROLLBACK;
