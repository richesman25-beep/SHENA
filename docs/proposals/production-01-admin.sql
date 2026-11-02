-- PROPOSITION NON EXÉCUTÉE. Accord + sauvegarde restaurée et vérifiée requis.
-- Examiner d'abord contraintes, rôles et politiques du projet SHENA existant.
-- Aucun produit ni utilisateur n'est créé. Aucun stock n'est réinitialisé.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='products' AND c.relrowsecurity) THEN
 RAISE EXCEPTION 'products doit exister avec RLS déjà activée : arrêter et examiner'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND cmd<>'SELECT') THEN
 RAISE EXCEPTION 'Politiques écriture existantes à examiner ; aucune politique supprimée automatiquement'; END IF;
END $$;
CREATE FUNCTION public.shena_is_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
 AS $$ SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=(SELECT auth.uid()) AND u.raw_app_meta_data->>'shena_role'='admin') $$;
REVOKE ALL ON FUNCTION public.shena_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shena_is_admin() TO authenticated;
-- Métadonnées applicatives de confiance, relues en base : user_metadata ne donne aucun droit.
-- L'attribution à un compte réel existant est une opération manuelle distincte et auditée.
CREATE POLICY shena_admin_products_select ON public.products FOR SELECT TO authenticated USING ((SELECT public.shena_is_admin()));
CREATE POLICY shena_admin_products_insert ON public.products FOR INSERT TO authenticated WITH CHECK ((SELECT public.shena_is_admin()));
CREATE POLICY shena_admin_products_update ON public.products FOR UPDATE TO authenticated USING ((SELECT public.shena_is_admin())) WITH CHECK ((SELECT public.shena_is_admin()));
GRANT SELECT,INSERT,UPDATE ON public.products TO authenticated;
-- Pas de politique de suppression ; la désactivation utilise active=false.
-- La politique existante de lecture des seuls produits actifs reste intacte.
CREATE FUNCTION public.shena_admin_status() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
 AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('version',1,
 'products',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='shena_admin_products_update'),
 'categories',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='shena_categories_admin'),
 'images',EXISTS(SELECT 1 FROM storage.buckets WHERE id='product-images' AND public=true) AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='shena_images_admin_insert'),
 'digital',EXISTS(SELECT 1 FROM storage.buckets WHERE id='digital-quarantine' AND public=false) AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='digital_assets' AND policyname='shena_assets_admin'),
 'geography',false);
 END $$;
REVOKE ALL ON FUNCTION public.shena_admin_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shena_admin_status() TO authenticated;
CREATE FUNCTION public.shena_catalog_features() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
 AS $$ SELECT jsonb_build_object('version',1,
 'categories',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='shena_categories_public'),
 'digitalDetails',EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='digital_product_details' AND policyname='shena_digital_details_public')) $$;
REVOKE ALL ON FUNCTION public.shena_catalog_features() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shena_catalog_features() TO anon,authenticated;
-- À retirer uniquement dans la version d'exécution explicitement approuvée.
ROLLBACK;
