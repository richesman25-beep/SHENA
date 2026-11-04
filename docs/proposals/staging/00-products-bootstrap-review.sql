-- SHENA-STAGING — DDL FIDÈLE AUX MÉTADONNÉES CONFIRMÉES PAR LE PROPRIÉTAIRE.
-- PROPOSITION POUR REVUE, NON EXÉCUTÉE. Aucune donnée Production/Auth/clé copiée.
-- Cible à vérifier au Dashboard : prqmomjtmyhqijysfoog.supabase.co.
-- Les étiquettes de session ci-dessous sont déclaratives, pas une preuve de la cible.
-- Aucun privilège dangereux Production n'est reproduit intentionnellement.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,public,pg_temp;
DO $target$
BEGIN
 IF current_user<>'postgres' OR current_setting('shena.review_context',true) IS DISTINCT FROM 'staging-reviewed'
    OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'prqmomjtmyhqijysfoog' THEN
   RAISE EXCEPTION 'Opérateur et projet SHENA-STAGING vérifiés requis'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN('r','p')) OR to_regclass('public.products') IS NOT NULL THEN
   RAISE EXCEPTION 'Schéma public non vide : arrêt, aucune table supprimée ou remplacée'; END IF;
 IF to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL THEN RAISE EXCEPTION 'gen_random_uuid natif requis ; ne pas installer une extension supposée'; END IF;
END $target$;

-- Fidèle : pas de NOT NULL ajouté aux sept colonnes déclarées nullables.
-- Pour les cinq défauts NULL rapportés, aucun DEFAULT n'est inventé.
CREATE TABLE public.products (
 id uuid DEFAULT gen_random_uuid() NOT NULL,
 created_at timestamp with time zone DEFAULT now() NOT NULL,
 name text,
 description text,
 price_htg numeric,
 product_type text,
 stock integer DEFAULT 0,
 image_url text,
 active boolean DEFAULT false,
 CONSTRAINT "SHENA_pkey" PRIMARY KEY (id)
);
-- Dans la même transaction que CREATE TABLE, avant toute ouverture au client.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- Une table neuve n'a pas FORCE RLS ; état source confirmé : FORCE=false.
REVOKE ALL PRIVILEGES ON TABLE public.products FROM PUBLIC,anon,authenticated;
CREATE POLICY "Public can view active product" ON public.products
 AS PERMISSIVE FOR SELECT TO anon,authenticated USING (active = true);
-- Pas de WITH CHECK, ni de politique INSERT/UPDATE/DELETE.
GRANT SELECT ON TABLE public.products TO anon,authenticated;

-- UNIQUE PRODUIT FICTIF, inactif. UUID et date utilisent les vrais défauts confirmés.
INSERT INTO public.products(name,description,price_htg,product_type,stock,image_url,active)
VALUES('SHENA STAGING — PRODUIT FICTIF',
 'Fixture technique uniquement : aucun achat, paiement ou téléchargement.',
 100,'physical',3,NULL,false);

DO $verify$
DECLARE r record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.products'::regclass AND relrowsecurity AND NOT relforcerowsecurity) THEN
   RAISE EXCEPTION 'État RLS inattendu'; END IF;
 FOR r IN SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated') LOOP
   IF NOT pg_catalog.has_table_privilege(r.oid,'public.products','SELECT')
      OR NOT pg_catalog.has_schema_privilege(r.oid,'public','USAGE')
      OR pg_catalog.has_any_column_privilege(r.oid,'public.products','INSERT')
      OR pg_catalog.has_any_column_privilege(r.oid,'public.products','UPDATE')
      OR pg_catalog.has_table_privilege(r.oid,'public.products','DELETE')
      OR pg_catalog.has_table_privilege(r.oid,'public.products','TRUNCATE') THEN
     RAISE EXCEPTION 'Privilèges effectifs non conformes pour % : audit avant ouverture',r.rolname; END IF;
 END LOOP;
END $verify$;
-- Écart volontaire à Production : les ACL dangereuses sont déjà retirées en staging.
-- Aucune contrainte CHECK/FK/UNIQUE additionnelle ni migration admin appliquée ici.
-- Propriétaire source, index autonomes/triggers/règles non attestés : examen distinct.
-- Version de revue : annule la table et sa fixture. Pas d'installation persistante.
ROLLBACK;
