-- PROPOSITION NON EXÉCUTÉE. Requiert 01,02,03 examinées et sauvegarde restaurée.
-- Arrêter si un nom existe déjà. Aucun ancien objet Storage n'est importé ou supprimé.
BEGIN;
CREATE TABLE public.admin_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_path text NOT NULL UNIQUE,
 public_url text NOT NULL UNIQUE CHECK(public_url ~ '^https://'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 2097152),
 state text NOT NULL DEFAULT 'active' CHECK(state IN('active','deleting','deleted')),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 deletion_token uuid, deletion_actor uuid REFERENCES auth.users(id),
 CHECK(object_path ~ '^managed/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);
CREATE TABLE public.product_media (
 product_id uuid NOT NULL REFERENCES public.products(id), media_id uuid NOT NULL REFERENCES public.admin_media(id),
 position integer NOT NULL DEFAULT 0 CHECK(position>=0),
 PRIMARY KEY(product_id,media_id)
);
CREATE TABLE public.admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor uuid, action text NOT NULL,
 entity_id uuid, happened_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_media,public.product_media,public.admin_audit FROM anon,authenticated;
GRANT SELECT ON public.admin_media,public.product_media,public.admin_audit TO authenticated;
CREATE POLICY shena_media_admin_read ON public.admin_media FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY shena_gallery_admin_read ON public.product_media FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY shena_audit_admin_read ON public.admin_audit FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
-- Registre et associations modifiables uniquement par les procédures autorisées.
CREATE FUNCTION public.shena_guard_main_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m public.admin_media; BEGIN
 IF TG_OP='UPDATE' AND NEW.image_url IS NOT DISTINCT FROM OLD.image_url THEN RETURN NEW; END IF;
 IF NEW.image_url IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO m FROM public.admin_media WHERE public_url=NEW.image_url FOR UPDATE;
 IF FOUND AND m.state<>'active' THEN RAISE EXCEPTION 'Média verrouillé'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shena_guard_main_image BEFORE INSERT OR UPDATE OF image_url ON public.products FOR EACH ROW EXECUTE FUNCTION public.shena_guard_main_image();
CREATE FUNCTION public.shena_register_product_image(p_product_id uuid,p_object_path text,p_public_url text,p_size bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE mid uuid; BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF p_object_path !~ ('^managed/'||auth.uid()::text||'/'||p_product_id::text||'/[0-9a-f-]{36}\.webp$') THEN RAISE EXCEPTION 'Chemin invalide'; END IF;
 -- URL doit correspondre à l'objet du bucket existant. Origine contrôlée par le projet/app,
 -- suffixe imposé en base ; une URL arbitraire ne peut désigner un autre objet géré.
 IF right(p_public_url,length('/storage/v1/object/public/product-images/'||p_object_path))<>('/storage/v1/object/public/product-images/'||p_object_path) THEN RAISE EXCEPTION 'URL invalide'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='product-images' AND name=p_object_path) THEN RAISE EXCEPTION 'Objet absent'; END IF;
 PERFORM 1 FROM public.products WHERE id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produit absent'; END IF;
 INSERT INTO public.admin_media(object_path,public_url,size_bytes,created_by) VALUES(p_object_path,p_public_url,p_size,auth.uid()) RETURNING id INTO mid;
 INSERT INTO public.product_media(product_id,media_id) VALUES(p_product_id,mid);
 UPDATE public.products SET image_url=p_public_url WHERE id=p_product_id;
 INSERT INTO public.admin_audit(actor,action,entity_id) VALUES(auth.uid(),'media.register',mid);
 RETURN mid;
END $$;
CREATE FUNCTION public.shena_set_primary_image(p_product_id uuid,p_media_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE url text; BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 SELECT m.public_url INTO url FROM public.admin_media m JOIN public.product_media pm ON pm.media_id=m.id WHERE m.id=p_media_id AND pm.product_id=p_product_id AND m.state='active' FOR UPDATE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Association active requise'; END IF;
 UPDATE public.products SET image_url=url WHERE id=p_product_id;
 INSERT INTO public.admin_audit(actor,action,entity_id) VALUES(auth.uid(),'media.primary',p_product_id);
END $$;
CREATE FUNCTION public.shena_reserve_media_deletion(p_media_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m public.admin_media; token uuid:=gen_random_uuid(); BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.admin_media WHERE id=p_media_id FOR UPDATE;
 IF NOT FOUND OR m.state<>'active' THEN RAISE EXCEPTION 'Média indisponible'; END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE image_url=m.public_url)
 OR EXISTS(SELECT 1 FROM public.product_media WHERE media_id=m.id) THEN RAISE EXCEPTION 'Média utilisé'; END IF;
 UPDATE public.admin_media SET state='deleting',deletion_token=token,deletion_actor=auth.uid() WHERE id=m.id;
 INSERT INTO public.admin_audit(actor,action,entity_id) VALUES(auth.uid(),'media.reserve_deletion',m.id);
 RETURN token;
END $$;
CREATE FUNCTION public.shena_finish_media_deletion(p_media_id uuid,p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 UPDATE public.admin_media SET state='deleted',deletion_token=NULL WHERE id=p_media_id AND state='deleting' AND deletion_token=p_token AND deletion_actor=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Réservation invalide'; END IF;
 INSERT INTO public.admin_audit(actor,action,entity_id) VALUES(auth.uid(),'media.deletion_confirmed',p_media_id);
END $$;
CREATE FUNCTION public.shena_remove_product_category(p_product_id uuid,p_category_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 DELETE FROM public.product_categories WHERE product_id=p_product_id AND category_id=p_category_id;
 INSERT INTO public.admin_audit(actor,action,entity_id) VALUES(auth.uid(),'category.unlink',p_product_id);
END $$;
-- Policies additives : aucune politique existante retirée. Préflight doit exclure toute
-- politique DELETE trop large sur storage.objects avant d'autoriser mediaDelete.
CREATE POLICY shena_managed_images_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='product-images' AND (SELECT public.shena_is_admin()) AND (storage.foldername(name))[1]='managed' AND (storage.foldername(name))[2]=(SELECT auth.uid())::text AND name ~ '^managed/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
CREATE POLICY shena_reserved_images_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='product-images' AND (SELECT public.shena_is_admin()) AND EXISTS(SELECT 1 FROM public.admin_media m WHERE m.object_path=name AND m.state='deleting' AND m.deletion_actor=(SELECT auth.uid())));
REVOKE ALL ON FUNCTION public.shena_guard_main_image(),public.shena_register_product_image(uuid,text,text,bigint),public.shena_set_primary_image(uuid,uuid),public.shena_reserve_media_deletion(uuid),public.shena_finish_media_deletion(uuid,uuid),public.shena_remove_product_category(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shena_register_product_image(uuid,text,text,bigint),public.shena_set_primary_image(uuid,uuid),public.shena_reserve_media_deletion(uuid),public.shena_finish_media_deletion(uuid,uuid),public.shena_remove_product_category(uuid,uuid) TO authenticated;
-- Les associations galerie ne sont pas supprimées automatiquement : média utilisé refusé.
-- Les anciens médias restent protégés et ne sont jamais effacés par l'application.
ROLLBACK;
