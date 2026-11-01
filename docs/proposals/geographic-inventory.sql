-- PROPOSITION UNIQUEMENT — NE PAS EXÉCUTER SANS APPROBATION EXPLICITE.
-- Aucun script applicatif, de build ou d'installation ne charge ce fichier.
-- SQL non testé contre le projet SHENA existant. Vérifier conflits et privilèges.
-- Ne recrée pas products, ne supprime aucune ligne, ne désactive aucune RLS.
-- La reprise de products.stock et les déclencheurs de synchronisation sont
-- volontairement séparés de cette proposition de structure.
BEGIN;

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  official_code text UNIQUE, name text NOT NULL UNIQUE,
  source_version text NOT NULL
);
CREATE TABLE public.communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id),
  official_code text UNIQUE, name text NOT NULL,
  UNIQUE (department_id, name), UNIQUE (id, department_id)
);
CREATE INDEX communes_department_idx ON public.communes(department_id);

CREATE TABLE public.logistics_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  active boolean NOT NULL DEFAULT false
);
ALTER TABLE public.logistics_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.logistics_admins FROM anon, authenticated;
GRANT SELECT ON public.logistics_admins TO authenticated;
CREATE POLICY logistics_admin_self ON public.logistics_admins FOR SELECT
  TO authenticated USING (user_id = (SELECT auth.uid()));
-- Attribution d'un administrateur : procédure de confiance distincte, auditée.
CREATE FUNCTION public.is_logistics_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$ SELECT EXISTS (
 SELECT 1 FROM public.logistics_admins
 WHERE user_id = (SELECT auth.uid()) AND active
) $$;
REVOKE ALL ON FUNCTION public.is_logistics_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_logistics_admin() TO authenticated;

CREATE TABLE public.stock_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 commune_id uuid NOT NULL REFERENCES public.communes(id),
 public_name text NOT NULL,
 active boolean NOT NULL DEFAULT false,
 publish_availability boolean NOT NULL DEFAULT false,
 publish_quantity boolean NOT NULL DEFAULT false,
 UNIQUE (id, commune_id)
);
CREATE INDEX stock_locations_commune_idx ON public.stock_locations(commune_id);
-- Coordonnées privées séparées, jamais dans les vues de catalogue.
CREATE TABLE public.stock_location_private_details (
 location_id uuid PRIMARY KEY REFERENCES public.stock_locations(id),
 private_address text, internal_notes text
);
-- Seuls les points de retrait autorisés peuvent avoir une adresse publiée.
CREATE TABLE public.pickup_points (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 location_id uuid NOT NULL REFERENCES public.stock_locations(id),
 public_address text NOT NULL,
 opening_hours text NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
CREATE INDEX pickup_points_location_idx ON public.pickup_points(location_id);
CREATE TABLE public.inventories (
 product_id uuid NOT NULL REFERENCES public.products(id),
 location_id uuid NOT NULL REFERENCES public.stock_locations(id),
 on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
 reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (product_id, location_id)
);
CREATE INDEX inventories_location_product_idx ON public.inventories(location_id, product_id);

CREATE TABLE public.delivery_methods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code IN ('pickup','local','interdepartmental')),
 name text NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE public.delivery_zones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 department_id uuid NOT NULL REFERENCES public.departments(id),
 commune_id uuid,
 FOREIGN KEY (commune_id, department_id) REFERENCES public.communes(id, department_id),
 label text NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
CREATE INDEX delivery_zones_destination_idx ON public.delivery_zones(department_id, commune_id);
CREATE TABLE public.delivery_rates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 origin_location_id uuid NOT NULL REFERENCES public.stock_locations(id),
 destination_zone_id uuid NOT NULL REFERENCES public.delivery_zones(id),
 method_id uuid NOT NULL REFERENCES public.delivery_methods(id),
 pickup_point_id uuid REFERENCES public.pickup_points(id),
 partner_label text,
 currency text NOT NULL DEFAULT 'HTG' CHECK (currency = 'HTG'),
 fee_minor bigint CHECK (fee_minor >= 0),
 min_days integer CHECK (min_days >= 0),
 max_days integer CHECK (max_days >= min_days),
 enabled boolean NOT NULL DEFAULT false,
 UNIQUE (origin_location_id, destination_zone_id, method_id)
);
CREATE INDEX delivery_rates_destination_idx ON public.delivery_rates(destination_zone_id, enabled);
CREATE INDEX delivery_rates_method_idx ON public.delivery_rates(method_id);
-- fee_minor NULL signifie "à confirmer", jamais gratuit.
-- Pour pickup, vérifier le rattachement du pickup_point à origin_location_id
-- via la future procédure métier/contrainte à valider avant activation.

CREATE TABLE public.shipments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL,
 owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 origin_location_id uuid NOT NULL REFERENCES public.stock_locations(id),
 destination_commune_id uuid NOT NULL REFERENCES public.communes(id),
 delivery_rate_id uuid REFERENCES public.delivery_rates(id),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','dispatched','delivered','cancelled')),
 shipping_fee_minor bigint CHECK (shipping_fee_minor >= 0),
 idempotency_key text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- public.orders n'est pas supposée exister. Ajouter sa FK uniquement dans
-- une migration ultérieure approuvée après validation du schéma des commandes.
CREATE INDEX shipments_order_idx ON public.shipments(order_id);
CREATE INDEX shipments_owner_created_idx ON public.shipments(owner_user_id, created_at);
CREATE INDEX shipments_origin_status_idx ON public.shipments(origin_location_id,status);
CREATE INDEX shipments_destination_idx ON public.shipments(destination_commune_id);
CREATE INDEX shipments_rate_idx ON public.shipments(delivery_rate_id);
CREATE TABLE public.shipment_tracking (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id uuid NOT NULL REFERENCES public.shipments(id),
 event_code text NOT NULL,
 public_message text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 provider_event_id text UNIQUE
);
CREATE INDEX shipment_tracking_shipment_time_idx ON public.shipment_tracking(shipment_id,occurred_at);

-- RLS activée partout. Pas de politique d'écriture anonyme ou d'auto-promotion.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['departments','communes','stock_locations',
 'stock_location_private_details','pickup_points','inventories','delivery_methods',
 'delivery_zones','delivery_rates','shipments','shipment_tracking'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY logistics_admin_access ON public.%I TO authenticated USING ((SELECT public.is_logistics_admin())) WITH CHECK ((SELECT public.is_logistics_admin()))',t);
 END LOOP;
END $$;
GRANT SELECT ON public.departments,public.communes TO anon;
CREATE POLICY departments_public_read ON public.departments FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY communes_public_read ON public.communes FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY shipment_owner_read ON public.shipments FOR SELECT TO authenticated
 USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY tracking_owner_read ON public.shipment_tracking FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.shipments s WHERE s.id=shipment_id AND s.owner_user_id=(SELECT auth.uid())));

-- Projection publique délibérément limitée ; le propriétaire de la vue doit
-- pouvoir lire ses sources sous RLS. Auditer son propriétaire avant tout GRANT.
-- Pas d'adresse privée, de stock réservé, ni de produit inactif exposé.
CREATE VIEW public.product_location_availability WITH (security_barrier=true) AS
 SELECT i.product_id, l.id AS location_id, l.public_name, l.commune_id,
        c.department_id,
        CASE WHEN l.publish_quantity THEN i.on_hand-i.reserved ELSE NULL END AS available_quantity
 FROM public.inventories i
 JOIN public.products p ON p.id=i.product_id
 JOIN public.stock_locations l ON l.id=i.location_id
 JOIN public.communes c ON c.id=l.commune_id
 WHERE p.active IS TRUE AND l.active AND l.publish_availability
   AND i.on_hand-i.reserved > 0;
REVOKE ALL ON public.product_location_availability FROM PUBLIC;
GRANT SELECT ON public.product_location_availability TO anon,authenticated;

-- Aucun département, commune, stock ou tarif n'est injecté par ce brouillon.
-- COMMIT à ajouter seulement après revue et tests sur un environnement séparé.
ROLLBACK;
