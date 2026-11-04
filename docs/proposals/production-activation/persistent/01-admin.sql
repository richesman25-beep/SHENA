-- INSTALLATION PERSISTANTE PROPOSÉE : 01-admin. NON EXÉCUTÉE.
-- Source préservée : docs/proposals/production-01-admin-production-candidate.sql ; SHA256 73b5750aaf0060915f53dfb64755e1d0a31b54f0d91960e2ed3c05c84b0788bb
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
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '01-admin'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accord de ce script, cible et restauration DB + Storage vérifiés requis'; END IF;
END $approval$;
SET LOCAL shena.acl_review_context='products-acl-reviewed';
-- PROPOSITION CORRIGÉE NON EXÉCUTÉE. Ne remplace pas le fichier historique.
-- Candidat PRODUCTION pour revue uniquement. Aucun SQL exécuté.
-- Sauvegarde restaurée/vérifiée et approbation explicite indispensables.
-- Les gardes de session sont déclaratives : elles ne prouvent ni cible ni restauration.
-- Exécuter ultérieurement dans UNE connexion, ON_ERROR_STOP actif, sans découpage.

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- Contrôle opératoire avant toute prise de verrou. Cette étiquette ne vérifie pas
-- l'identité du projet : comparer impérativement la connexion au Dashboard staging.
DO $context$
BEGIN
  IF current_setting('shena.review_context', true) IS DISTINCT FROM 'production-reviewed' THEN
    RAISE EXCEPTION 'Revue Production explicite requise ; aucune activation implicite';
  END IF;
  IF current_setting('shena.target_project_ref', true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
     OR current_setting('shena.backup_restore_verified', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Cible Production identifiée et preuve de restauration examinée requises';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Opérateur postgres attendu ; examiner explicitement tout autre propriétaire';
  END IF;
END $context$;
-- Aucun appel réseau et aucune dépendance à Storage dans les fonctions de capacités.
LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;
DO $guard$
DECLARE
  t oid := 'public.products'::regclass;
  r record;
  expected text[] := ARRAY['active','created_at','description','id','image_url','name','price_htg','product_type','stock'];
  actual text[];
  predicate text;
  public_oid oid := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid=t AND relkind='r' AND relrowsecurity AND relowner='postgres'::regrole)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid=t OR inhparent=t) THEN
    RAISE EXCEPTION 'Table ordinaire products, propriétaire postgres, RLS active et sans héritage requis';
  END IF;
  SELECT array_agg(attname::text ORDER BY attname) INTO actual
    FROM pg_catalog.pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Colonnes différentes du contrat à neuf colonnes : arrêt'; END IF;
  FOR r IN SELECT attname,atttypid,atttypmod,attidentity,attgenerated
      FROM pg_catalog.pg_attribute WHERE attrelid=t AND attnum>0 AND NOT attisdropped LOOP
    IF r.attidentity<>'' OR r.attgenerated<>'' THEN RAISE EXCEPTION 'Colonne générée/identity non examinée : %',r.attname; END IF;
    IF (r.attname='id' AND r.atttypid<>'uuid'::regtype)
    OR (r.attname='created_at' AND r.atttypid<>'timestamptz'::regtype)
    OR (r.attname='active' AND r.atttypid<>'bool'::regtype)
    OR (r.attname='stock' AND r.atttypid NOT IN ('int4'::regtype,'int8'::regtype))
    OR (r.attname='price_htg' AND (r.atttypid<>'numeric'::regtype OR r.atttypmod<>-1))
    OR (r.attname IN('name','description','image_url','product_type') AND r.atttypid NOT IN ('text'::regtype,'varchar'::regtype)) THEN
      RAISE EXCEPTION 'Type SQL non approuvé pour % ; examiner enum, domaines, précision et arrondis',r.attname;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=t AND attname='image_url' AND attnotnull) THEN
    RAISE EXCEPTION 'image_url doit accepter NULL pour créer un produit avant son upload';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=t AND contype='p'
      AND conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=t AND attname='id')]::smallint[]) THEN
    RAISE EXCEPTION 'Clé primaire simple sur id requise';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=t AND NOT tgisinternal)
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class=t AND rulename<>'_RETURN') THEN
    RAISE EXCEPTION 'Triggers/règles personnalisés à examiner séparément';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policy WHERE polrelid=t)<>1 THEN
    RAISE EXCEPTION 'Une seule politique publique SELECT préexistante attendue';
  END IF;
  SELECT pg_catalog.pg_get_expr(polqual,polrelid) INTO predicate FROM pg_catalog.pg_policy
    WHERE polrelid=t AND polcmd='r' AND polpermissive AND polwithcheck IS NULL
      AND (public_oid=ANY(polroles) OR ('anon'::regrole=ANY(polroles) AND 'authenticated'::regrole=ANY(polroles)));
  IF predicate IS NULL OR predicate NOT IN('active','(active = true)','(active IS TRUE)') THEN
    RAISE EXCEPTION 'Politique publique non reconnue : comparer son expression et ses rôles, sans la supprimer';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace
      AND proname IN('shena_is_admin','shena_admin_status','shena_catalog_features')) THEN
    RAISE EXCEPTION 'Fonction homonyme existante : comparer, ne pas remplacer automatiquement';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND p.prosecdef AND p.prokind IN('f','p') AND
      (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))
      -- Fonction événementielle auditée le 2026-11-03 : non appelable comme RPC.
      -- Tout changement de corps/propriétaire/configuration exige un nouvel examen.
      AND NOT COALESCE((p.oid=pg_catalog.to_regprocedure('public.rls_auto_enable()')
        AND p.prorettype='pg_catalog.event_trigger'::regtype AND p.pronargs=0
        AND p.proowner='postgres'::regrole AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
        AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
        AND pg_catalog.md5(p.prosrc)='c44fb229ea8a6b0afd04a0a33261c16c'),false)) THEN
    RAISE EXCEPTION 'RPC SECURITY DEFINER publique déjà accessible : audit séparé requis';
  END IF;
  FOR r IN SELECT oid,rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolcanlogin
      FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated') LOOP
    IF r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolcanlogin
       OR pg_catalog.has_schema_privilege(r.oid,'public','CREATE')
       OR pg_catalog.has_schema_privilege(r.oid,'auth','CREATE')
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid)
       OR pg_catalog.has_any_column_privilege(r.oid,'auth.users','UPDATE')
       OR pg_catalog.has_any_column_privilege(r.oid,'auth.users','INSERT')
       OR pg_catalog.has_table_privilege(r.oid,'auth.users','DELETE')
       OR pg_catalog.has_table_privilege(r.oid,'auth.users','TRUNCATE') THEN
      RAISE EXCEPTION 'Privilèges/membres dangereux ou non examinés pour %',r.rolname;
    END IF;
  END LOOP;
  -- Les droits PUBLIC et hérités ne sont pas annulés par REVOKE sur un rôle direct.
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL
      pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      WHERE c.oid=t AND a.grantee=0 AND a.privilege_type<>'SELECT')
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute c CROSS JOIN LATERAL pg_catalog.aclexplode(c.attacl) a
      WHERE c.attrelid=t AND a.grantee=0 AND a.privilege_type<>'SELECT') THEN
    RAISE EXCEPTION 'Privilège écriture PUBLIC : plan de correction distinct requis';
  END IF;
  -- Lecture de contrôle seulement : aucune correction automatique d'anciennes lignes.
  IF EXISTS(SELECT 1 FROM public.products WHERE
      id IS NULL OR created_at IS NULL OR active IS NULL
      OR name IS NULL OR length(btrim(name)) NOT BETWEEN 1 AND 160
      OR (description IS NOT NULL AND length(description)>15000)
      OR price_htg IS NULL OR price_htg::text IN('NaN','Infinity','-Infinity')
      OR price_htg<0 OR price_htg>100000000 OR price_htg<>round(price_htg,2)
      OR stock IS NULL OR stock<0 OR stock>1000000
      OR product_type IS NULL OR product_type NOT IN
        ('physical','digital','preorder','stock','physical_stock','physique','in_stock','physical_preorder','sur_commande','numerique','numérique')
      OR (product_type IN('digital','numerique','numérique','preorder','physical_preorder','sur_commande') AND stock<>0)) THEN
    RAISE EXCEPTION 'Anciennes données hors contrat : arrêt, aucun prix/stock/type modifié';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=t AND conname LIKE 'shena_reviewed_%') THEN
    RAISE EXCEPTION 'Contraintes homonymes déjà présentes : arrêt';
  END IF;
END
$guard$;

-- Défense base contre les appels REST directs, indépendamment des formulaires.
-- NOT VALID ne réécrit pas les données ; contrôle ultérieur explicite ci-dessous.
ALTER TABLE public.products
 ADD CONSTRAINT shena_reviewed_price CHECK(price_htg IS NOT NULL AND price_htg::text NOT IN('NaN','Infinity','-Infinity') AND price_htg BETWEEN 0 AND 100000000 AND price_htg=round(price_htg,2)) NOT VALID,
 ADD CONSTRAINT shena_reviewed_stock CHECK(stock IS NOT NULL AND stock BETWEEN 0 AND 1000000) NOT VALID,
 ADD CONSTRAINT shena_reviewed_type CHECK(product_type IS NOT NULL AND product_type IN('physical','digital','preorder','stock','physical_stock','physique','in_stock','physical_preorder','sur_commande','numerique','numérique')) NOT VALID,
 ADD CONSTRAINT shena_reviewed_nonphysical_stock CHECK(product_type NOT IN('digital','numerique','numérique','preorder','physical_preorder','sur_commande') OR stock=0) NOT VALID,
 ADD CONSTRAINT shena_reviewed_required CHECK(created_at IS NOT NULL AND active IS NOT NULL AND name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 160 AND (description IS NULL OR length(description)<=15000)) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT shena_reviewed_price;
ALTER TABLE public.products VALIDATE CONSTRAINT shena_reviewed_stock;
ALTER TABLE public.products VALIDATE CONSTRAINT shena_reviewed_type;
ALTER TABLE public.products VALIDATE CONSTRAINT shena_reviewed_nonphysical_stock;
ALTER TABLE public.products VALIDATE CONSTRAINT shena_reviewed_required;

-- Propriétaire de confiance explicite ; corps fixe, aucun argument ni SQL dynamique.
-- Pas d'interprétation du rôle contenu dans user_metadata ou dans le JWT app_metadata.
CREATE FUNCTION public.shena_is_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp
 AS $body$
 SELECT EXISTS(SELECT 1 FROM auth.users u
   WHERE u.id=(SELECT auth.uid()) AND u.email_confirmed_at IS NOT NULL
     AND u.raw_app_meta_data->'shena_role'='"admin"'::jsonb)
 $body$;
ALTER FUNCTION public.shena_is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_is_admin() TO authenticated;

CREATE POLICY shena_admin_products_select ON public.products FOR SELECT TO authenticated
 USING ((SELECT public.shena_is_admin()));
CREATE POLICY shena_admin_products_insert ON public.products FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.shena_is_admin()));
CREATE POLICY shena_admin_products_update ON public.products FOR UPDATE TO authenticated
 USING ((SELECT public.shena_is_admin())) WITH CHECK ((SELECT public.shena_is_admin()));
-- Empêche une future politique permissive client d'ouvrir l'écriture par OR.
CREATE POLICY shena_admin_insert_guard ON public.products AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.shena_is_admin()));
CREATE POLICY shena_admin_update_guard ON public.products AS RESTRICTIVE FOR UPDATE TO authenticated
 USING ((SELECT public.shena_is_admin())) WITH CHECK ((SELECT public.shena_is_admin()));

-- Ne pas accorder TRUNCATE (RLS ne protège pas TRUNCATE), DELETE, TRIGGER ou REFERENCES.
-- Retirer aussi les grants de colonne directs, que REVOKE table ne retire pas.
REVOKE ALL PRIVILEGES ON TABLE public.products FROM anon,authenticated;
REVOKE INSERT(id,created_at,name,description,price_htg,product_type,stock,image_url,active),
 UPDATE(id,created_at,name,description,price_htg,product_type,stock,image_url,active),
 REFERENCES(id,created_at,name,description,price_htg,product_type,stock,image_url,active)
 ON public.products FROM anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT(id,created_at,name,description,price_htg,product_type,stock,image_url,active)
 ON public.products TO anon,authenticated;
GRANT INSERT(id,created_at,name,description,price_htg,product_type,stock,image_url,active)
 ON public.products TO authenticated;
GRANT UPDATE(name,description,price_htg,product_type,stock,image_url,active)
 ON public.products TO authenticated;

-- Manifeste minimal : produits seuls. Les autres modules ne sont pas audités ici.
-- SECURITY INVOKER : aucune lecture de catalogues/Storage avec droits élevés.
CREATE FUNCTION public.shena_admin_status() RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp
 AS $body$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('version',1,'products',true,'categories',false,'images',false,'digital',false,'geography',false);
 END $body$;
CREATE FUNCTION public.shena_catalog_features() RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp
 AS $body$ SELECT jsonb_build_object('version',1,'categories',false,'digitalDetails',false) $body$;
ALTER FUNCTION public.shena_admin_status() OWNER TO postgres;
ALTER FUNCTION public.shena_catalog_features() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_admin_status(),public.shena_catalog_features() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_admin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.shena_catalog_features() TO anon,authenticated;

-- Aucun protocole de tests de mutation Auth/produits ne doit être exécuté en Production.
-- Aucun test de données Production inséré ici.
-- Version persistante DISTINCTE : les fichiers de revue gardent ROLLBACK.
COMMIT;
