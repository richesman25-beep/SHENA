-- INSTALLATION PERSISTANTE PROPOSÉE : 04-digital-delivery. NON EXÉCUTÉE.
-- Source préservée : docs/proposals/production-activation/04-digital-delivery-review.sql ; SHA256 abed0244cbf11b36a9c9d9df41e8c85c3561cf58d32d75d9ceefd5a9b720ad4f
-- Ne pas exécuter sans revue du fichier exact et approbation explicite.
-- Les paramètres sont des attestations opérateur, pas une preuve de restauration.
-- Aucun script applicatif/build n'exécute ce fichier.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $approval$ BEGIN
 IF current_user<>'postgres'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed'
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '04-digital-delivery'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accord de ce script, cible et restauration DB + Storage vérifiés requis'; END IF;
END $approval$;
SET LOCAL shena.acl_review_context='products-acl-reviewed';
-- PROPOSITION NON EXÉCUTÉE. Aucune livraison activée, aucun paiement simulé.
-- Deux admins doivent attester un fichier immuable et son contrôle de sécurité.
-- L'attestation opérateur ne constitue pas un antivirus automatisé.

SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Production et restauration vérifiées requises'; END IF;
 IF to_regclass('public.commerce_orders') IS NULL OR to_regclass('public.digital_assets') IS NULL THEN RAISE EXCEPTION 'Commerce et Storage protégés requis'; END IF;
 IF (SELECT count(*) FROM storage.buckets WHERE id IN('digital-quarantine','digital-products') AND NOT public)<>2 THEN RAISE EXCEPTION 'Buckets privés requis'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='storage.objects'::regclass AND polname='shena_prod_private_read_guard' AND NOT polpermissive AND polcmd='r') THEN RAISE EXCEPTION 'Garde restrictive Storage préalable requise'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.shena_can_download(text,text)') AND NOT prosecdef AND proowner='postgres'::regrole AND pg_catalog.md5(prosrc)='3ae94a39ba9f187cd82a90200bb15269') THEN RAISE EXCEPTION 'Helper numérique initial modifié : revue requise'; END IF;
END $guard$;
ALTER TABLE public.commerce_settings ADD COLUMN digital_delivery_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.digital_releases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES public.products(id),
 bucket text NOT NULL DEFAULT 'digital-products' CHECK(bucket='digital-products'),object_path text NOT NULL UNIQUE,
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 200 AND display_name !~ '[\r\n]'),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),security_report text NOT NULL CHECK(length(btrim(security_report)) BETWEEN 10 AND 2000),
 submitted_by uuid NOT NULL REFERENCES auth.users(id),approved_by uuid REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz,
 CHECK(status<>'approved' OR(approved_by IS NOT NULL AND approved_by<>submitted_by AND approved_at IS NOT NULL))
);
ALTER TABLE public.digital_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_releases FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,product_id,bucket,object_path,display_name,status) ON public.digital_releases TO authenticated;
CREATE OR REPLACE FUNCTION public.shena_can_download(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM public.commerce_settings WHERE singleton AND digital_delivery_enabled)
 AND EXISTS(SELECT 1 FROM public.digital_releases r
 JOIN public.commerce_order_lines l ON l.product_id=r.product_id AND l.product_type='digital'
 JOIN public.commerce_orders o ON o.id=l.order_id
 JOIN public.commerce_payment_reviews v ON v.id=o.payment_verified_review_id AND v.order_id=o.id
 WHERE r.bucket=p_bucket AND r.object_path=p_path AND r.status='approved'
 AND r.approved_by<>r.submitted_by AND r.approved_at IS NOT NULL
 AND o.customer_id=auth.uid() AND o.status IN('paid','processing','shipped','delivered')
 AND v.status='approved' AND v.verified_by IS NOT NULL AND v.verified_by<>v.submitted_by AND v.amount_minor=o.total_minor)
$$;
ALTER FUNCTION public.shena_can_download(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_can_download(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_can_download(text,text) TO anon,authenticated;
CREATE POLICY shena_prod_releases_read ON public.digital_releases FOR SELECT TO authenticated
 USING((SELECT public.shena_is_admin()) OR public.shena_can_download(bucket,object_path));
CREATE POLICY shena_prod_paid_object_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='digital-products' AND public.shena_can_download(bucket_id,name));
CREATE FUNCTION public.shena_digital_delivery_features() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$
 SELECT jsonb_build_object('version',1,'enabled',COALESCE((SELECT digital_delivery_enabled FROM public.commerce_settings WHERE singleton),false))
$$;
REVOKE ALL ON FUNCTION public.shena_digital_delivery_features() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_digital_delivery_features() TO authenticated;
CREATE FUNCTION public.shena_register_digital_release(p_product_id uuid,p_object_path text,p_display_name text,p_sha256 text,p_security_report text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE rid uuid;
BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF p_object_path IS NULL OR p_object_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.pdf$'
 OR (storage.foldername(p_object_path))[1]<>auth.uid()::text OR (storage.foldername(p_object_path))[2]<>p_product_id::text THEN RAISE EXCEPTION 'Chemin immuable attendu'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id AND product_type IN('digital','numerique','numérique')) THEN RAISE EXCEPTION 'Produit numérique requis'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='digital-products' AND name=p_object_path) THEN RAISE EXCEPTION 'Objet privé réel requis'; END IF;
 INSERT INTO public.digital_releases(product_id,object_path,display_name,sha256,security_report,submitted_by)
 VALUES(p_product_id,p_object_path,btrim(p_display_name),p_sha256,btrim(p_security_report),auth.uid()) RETURNING id INTO rid;
 INSERT INTO public.commerce_audit_events(actor_id,action,details) VALUES(auth.uid(),'digital.release_submitted',jsonb_build_object('release_id',rid,'sha256',p_sha256));
 RETURN rid;
END $$;
CREATE FUNCTION public.shena_review_digital_release(p_id uuid,p_decision text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.digital_releases;
BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN('approved','revoked') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Décision justifiée requise'; END IF;
 SELECT * INTO r FROM public.digital_releases WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (p_decision='approved' AND(r.status<>'pending' OR r.submitted_by=auth.uid()
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=r.submitted_by AND email_confirmed_at IS NOT NULL AND raw_app_meta_data->'shena_role'='"admin"'::jsonb))) THEN RAISE EXCEPTION 'Second administrateur distinct requis'; END IF;
 UPDATE public.digital_releases SET status=p_decision,approved_by=CASE WHEN p_decision='approved' THEN auth.uid() ELSE approved_by END,approved_at=CASE WHEN p_decision='approved' THEN now() ELSE approved_at END WHERE id=r.id;
 INSERT INTO public.commerce_audit_events(actor_id,action,details) VALUES(auth.uid(),'digital.release_'||p_decision,jsonb_build_object('release_id',r.id,'note',btrim(p_note)));
END $$;
ALTER FUNCTION public.shena_register_digital_release(uuid,text,text,text,text) OWNER TO postgres;
ALTER FUNCTION public.shena_review_digital_release(uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_register_digital_release(uuid,text,text,text,text),public.shena_review_digital_release(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_register_digital_release(uuid,text,text,text,text),public.shena_review_digital_release(uuid,text,text) TO authenticated;
CREATE FUNCTION public.shena_admin_digital_releases() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) FROM(SELECT id,product_id,bucket,object_path,display_name,sha256,security_report,submitted_by,approved_by,status,created_at FROM public.digital_releases ORDER BY created_at DESC LIMIT 200) r);
END $$;
ALTER FUNCTION public.shena_admin_digital_releases() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_admin_digital_releases() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_admin_digital_releases() TO authenticated;
-- Aucun UPDATE des réglages, aucune livraison activée par cette migration.
-- Version persistante DISTINCTE : les fichiers de revue gardent ROLLBACK.
COMMIT;
