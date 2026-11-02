-- PROPOSITION NON EXÉCUTÉE. Dépend du brouillon 01 approuvé.
-- Contrôler qu'aucun bucket de ces noms n'existe. Ne pas convertir un bucket
-- existant privé en public, ni écraser ses politiques ou ses données.
BEGIN;
-- Réutilise le bucket existant sans changer sa visibilité, ses limites ou ses fichiers.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='product-images' AND public=true) THEN
 RAISE EXCEPTION 'Bucket product-images public existant requis ; ne pas recréer automatiquement'; END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('digital-quarantine','digital-quarantine',false,2097152,ARRAY['application/pdf']);
INSERT INTO storage.buckets(id,name,public,file_size_limit)
 VALUES('digital-products','digital-products',false,104857600);
-- Les anciens fichiers ne sont pas supprimés. Chemin : user_id/product_id/uuid.ext.
CREATE POLICY shena_images_admin_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='product-images' AND (SELECT public.shena_is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY shena_images_admin_select ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='product-images' AND (SELECT public.shena_is_admin()));
CREATE POLICY shena_private_admin_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='digital-quarantine' AND (SELECT public.shena_is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY shena_private_admin_select ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id IN('digital-quarantine','digital-products') AND (SELECT public.shena_is_admin()));
-- Aucune politique client ni endpoint de lien signé pour les fichiers payants.
CREATE TABLE public.digital_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id),
 bucket text NOT NULL CHECK(bucket='digital-quarantine'),
 object_path text NOT NULL UNIQUE,
 original_name text NOT NULL CHECK(length(original_name)<=200),
 mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=2097152),
 status text NOT NULL DEFAULT 'quarantine' CHECK(status IN('quarantine','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX digital_assets_product_idx ON public.digital_assets(product_id,created_at);
ALTER TABLE public.digital_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_assets FROM anon,authenticated;
GRANT SELECT,INSERT ON public.digital_assets TO authenticated;
CREATE POLICY shena_assets_admin ON public.digital_assets TO authenticated
 USING((SELECT public.shena_is_admin())) WITH CHECK((SELECT public.shena_is_admin()));
-- Publication, antivirus, droits d'achat et passage vers digital-products : phase distincte.
ROLLBACK;
