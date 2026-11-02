-- PROPOSITION NON EXÉCUTÉE. Dépend du brouillon 01 approuvé.
-- Vérifier conflits de noms, sauvegarde, restauration et autorisation avant application.
BEGIN;
CREATE TABLE public.categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=80),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.product_categories (
 product_id uuid NOT NULL REFERENCES public.products(id),
 category_id uuid NOT NULL REFERENCES public.categories(id),
 PRIMARY KEY(product_id,category_id)
);
CREATE INDEX product_categories_category_idx ON public.product_categories(category_id,product_id);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categories,public.product_categories FROM anon,authenticated;
GRANT SELECT ON public.categories,public.product_categories TO anon,authenticated;
GRANT INSERT,UPDATE ON public.categories TO authenticated;
GRANT INSERT,UPDATE ON public.product_categories TO authenticated;
CREATE POLICY shena_categories_public ON public.categories FOR SELECT TO anon,authenticated USING(active);
CREATE POLICY shena_categories_admin ON public.categories TO authenticated USING((SELECT public.shena_is_admin())) WITH CHECK((SELECT public.shena_is_admin()));
CREATE POLICY shena_product_categories_public ON public.product_categories FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.active) AND EXISTS(SELECT 1 FROM public.categories c WHERE c.id=category_id AND c.active));
CREATE POLICY shena_product_categories_admin ON public.product_categories TO authenticated USING((SELECT public.shena_is_admin())) WITH CHECK((SELECT public.shena_is_admin()));
-- Aucun classement des anciens produits n'est deviné ni injecté.
ROLLBACK;
