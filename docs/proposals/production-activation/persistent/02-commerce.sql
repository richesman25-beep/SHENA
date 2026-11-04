-- INSTALLATION PERSISTANTE PROPOSÉE : 02-commerce. NON EXÉCUTÉE.
-- Source préservée : docs/proposals/production-activation/02-commerce-review.sql ; SHA256 e83c9bb46ecd5f67a828fc8956b295379985cac43a61ebee0db3b288129fd8a0
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
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '02-commerce'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accord de ce script, cible et restauration DB + Storage vérifiés requis'; END IF;
END $approval$;
SET LOCAL shena.acl_review_context='products-acl-reviewed';
-- CANDIDAT PRODUCTION — NON EXÉCUTÉ. Réglages initialement désactivés.
-- Prérequis : inventaire réel, sauvegarde restaurée/vérifiée et migration admin approuvée.
-- N'active aucune commande/paiement. Les réglages restent désactivés.
-- Aucun tarif, compte, clé, paiement, transaction ou produit fictif n'est injecté.

SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Opérateur et cible Production vérifiés requis'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.products'::regclass AND relrowsecurity)
 OR to_regprocedure('public.shena_is_admin()') IS NULL THEN RAISE EXCEPTION 'Produits réels et autorisations admin préalables requis'; END IF;
 IF current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy' OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Cible et restauration vérifiées requises'; END IF;
END $guard$;
CREATE TABLE public.commerce_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 orders_enabled boolean NOT NULL DEFAULT false,
 manual_payments_enabled boolean NOT NULL DEFAULT false,
 reservation_minutes integer CHECK(reservation_minutes BETWEEN 1 AND 1440),
 CHECK(NOT orders_enabled OR reservation_minutes IS NOT NULL),
 CHECK(NOT manual_payments_enabled OR orders_enabled)
);
INSERT INTO public.commerce_settings(singleton) VALUES(true);
-- Référentiel public DÉJÀ présent dans src/lib/geography.ts : sous-ensemble
-- pris en charge, IDs internes non officiels ; aucune donnée client ni tarif.
CREATE TABLE public.commerce_communes(
 id text NOT NULL,department_id text NOT NULL,
 PRIMARY KEY(department_id,id),UNIQUE(id)
);
INSERT INTO public.commerce_communes(id,department_id) VALUES
 ('port-au-prince','ouest'),('petion-ville','ouest'),('delmas','ouest'),
 ('cap-haitien','nord'),('limbe','nord'),('fort-liberte','nord-est'),
 ('port-de-paix','nord-ouest'),('hinche','centre'),('maissade','centre'),
 ('mirebalais','centre'),('gonaives','artibonite'),('saint-marc','artibonite'),
 ('les-cayes','sud'),('jacmel','sud-est'),('jeremie','grand-anse'),('miragoane','nippes');
CREATE TABLE public.commerce_delivery_zones(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 100),
 department_id text NOT NULL CHECK(department_id IN('ouest','nord','nord-est','nord-ouest','centre','artibonite','sud','sud-est','grand-anse','nippes')),
 commune_id text CHECK(commune_id IS NULL OR length(commune_id) BETWEEN 1 AND 100),
 fee_minor bigint NOT NULL CHECK(fee_minor BETWEEN 0 AND 10000000000),active boolean NOT NULL DEFAULT false,
 FOREIGN KEY(department_id,commune_id) REFERENCES public.commerce_communes(department_id,id)
);
CREATE UNIQUE INDEX commerce_zone_active_destination ON public.commerce_delivery_zones(department_id,COALESCE(commune_id,'')) WHERE active;
CREATE TABLE public.commerce_orders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number text NOT NULL UNIQUE DEFAULT 'SH-'||upper(gen_random_uuid()::text),
 customer_id uuid NOT NULL REFERENCES auth.users(id),idempotency_key uuid NOT NULL,idempotency_payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending_payment' CHECK(status IN('pending_payment','paid','processing','shipped','delivered','cancelled','refunded')),
 subtotal_minor bigint NOT NULL CHECK(subtotal_minor>=0),delivery_minor bigint NOT NULL CHECK(delivery_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor=subtotal_minor+delivery_minor AND total_minor<=9007199254740991),currency text NOT NULL DEFAULT 'HTG' CHECK(currency='HTG'),
 customer_name text NOT NULL CHECK(length(customer_name) BETWEEN 2 AND 120),customer_phone text NOT NULL CHECK(length(customer_phone) BETWEEN 7 AND 32),
 delivery_address text NOT NULL CHECK(length(delivery_address)<=500),note text NOT NULL CHECK(length(note)<=1000),
 department_id text,commune_id text,zone_id uuid REFERENCES public.commerce_delivery_zones(id),zone_name text,
 created_at timestamptz NOT NULL DEFAULT now(),reservation_expires_at timestamptz NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>=1),payment_verified_review_id uuid,
 UNIQUE(customer_id,idempotency_key),
 CHECK(status NOT IN('paid','processing','shipped','delivered','refunded') OR payment_verified_review_id IS NOT NULL)
);
CREATE INDEX commerce_orders_customer_date ON public.commerce_orders(customer_id,created_at DESC);
CREATE TABLE public.commerce_order_lines(
 order_id uuid NOT NULL REFERENCES public.commerce_orders(id),product_id uuid NOT NULL REFERENCES public.products(id),
 product_name text NOT NULL,product_type text NOT NULL CHECK(product_type IN('physical','digital')),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),
 total_minor bigint NOT NULL CHECK(total_minor=unit_price_minor*quantity),
 PRIMARY KEY(order_id,product_id),CHECK(product_type<>'digital' OR quantity=1)
);
-- Comptes d'encaissement configurés seulement par un opérateur approuvé.
-- Aucune coordonnée marchande inventée ou préremplie.
CREATE TABLE public.commerce_payment_accounts(
 provider text PRIMARY KEY CHECK(provider IN('moncash','natcash')),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 120),
 account_identifier text NOT NULL CHECK(length(btrim(account_identifier)) BETWEEN 4 AND 160),
 approval_evidence text NOT NULL CHECK(length(btrim(approval_evidence)) BETWEEN 10 AND 2000),
 active boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commerce_payment_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commerce_payment_accounts FROM PUBLIC,anon,authenticated;
GRANT SELECT(provider,display_name,account_identifier,active) ON public.commerce_payment_accounts TO authenticated;
CREATE POLICY commerce_accounts_read ON public.commerce_payment_accounts FOR SELECT TO authenticated USING(active OR (SELECT public.shena_is_admin()));
CREATE TABLE public.commerce_payment_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.commerce_orders(id),
 provider text NOT NULL CHECK(provider IN('moncash','natcash')),external_reference text NOT NULL CHECK(length(external_reference) BETWEEN 4 AND 160),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 submitted_by uuid NOT NULL REFERENCES auth.users(id),verified_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),verified_at timestamptz,
 submit_note text NOT NULL CHECK(length(submit_note) BETWEEN 10 AND 1000),review_note text,
 idempotency_key uuid NOT NULL,receiver_snapshot jsonb NOT NULL CHECK(jsonb_typeof(receiver_snapshot)='object'),
 UNIQUE(provider,external_reference),UNIQUE(submitted_by,idempotency_key),
 CHECK(status='pending' OR (verified_by IS NOT NULL AND verified_by<>submitted_by AND verified_at IS NOT NULL AND length(review_note) BETWEEN 10 AND 1000))
);
CREATE UNIQUE INDEX commerce_one_pending_review ON public.commerce_payment_reviews(order_id) WHERE status='pending';
ALTER TABLE public.commerce_orders ADD CONSTRAINT commerce_order_verified_review_fk FOREIGN KEY(payment_verified_review_id) REFERENCES public.commerce_payment_reviews(id);
CREATE TABLE public.commerce_audit_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid REFERENCES public.commerce_orders(id),
 actor_id uuid REFERENCES auth.users(id),action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),details jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.commerce_communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_payment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_audit_events ENABLE ROW LEVEL SECURITY;
-- Annuler les privilèges par défaut avant toute future validation de la transaction.
REVOKE ALL ON public.commerce_communes,public.commerce_settings,public.commerce_delivery_zones,public.commerce_orders,public.commerce_order_lines,public.commerce_payment_reviews,public.commerce_audit_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.commerce_audit_events_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.commerce_communes,public.commerce_settings,public.commerce_delivery_zones TO anon,authenticated;
GRANT SELECT(id,order_number,customer_id,status,subtotal_minor,delivery_minor,total_minor,currency,created_at,reservation_expires_at,payment_verified_review_id,version,customer_name,customer_phone,delivery_address,department_id,commune_id,note,zone_name) ON public.commerce_orders TO authenticated;
GRANT SELECT ON public.commerce_order_lines,public.commerce_payment_reviews,public.commerce_audit_events TO authenticated;
CREATE POLICY commerce_communes_read ON public.commerce_communes FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY commerce_settings_read ON public.commerce_settings FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY commerce_zones_public ON public.commerce_delivery_zones FOR SELECT TO anon,authenticated USING(active);
CREATE POLICY commerce_zones_admin ON public.commerce_delivery_zones FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY commerce_orders_owner ON public.commerce_orders FOR SELECT TO authenticated USING(customer_id=(SELECT auth.uid()));
CREATE POLICY commerce_orders_admin ON public.commerce_orders FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY commerce_lines_owner ON public.commerce_order_lines FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.commerce_orders o WHERE o.id=order_id));
CREATE POLICY commerce_reviews_admin ON public.commerce_payment_reviews FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE POLICY commerce_audit_admin ON public.commerce_audit_events FOR SELECT TO authenticated USING((SELECT public.shena_is_admin()));
CREATE FUNCTION public.shena_checkout_features() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp
 AS $$ SELECT jsonb_build_object('version',1,'delivery',true,'orders',orders_enabled,'manualPayments',manual_payments_enabled,'digitalDelivery',false) FROM public.commerce_settings WHERE singleton $$;

CREATE FUNCTION public.shena_save_delivery_zone(p_id uuid,p_name text,p_department_id text,p_commune_id text,p_fee_minor bigint,p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_name IS NULL OR p_fee_minor IS NULL OR p_active IS NULL THEN RAISE EXCEPTION 'Tarif incomplet'; END IF;
 INSERT INTO public.commerce_delivery_zones(id,name,department_id,commune_id,fee_minor,active)
 VALUES(p_id,btrim(p_name),p_department_id,NULLIF(btrim(p_commune_id),''),p_fee_minor,p_active)
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,department_id=EXCLUDED.department_id,commune_id=EXCLUDED.commune_id,fee_minor=EXCLUDED.fee_minor,active=EXCLUDED.active;
 INSERT INTO public.commerce_audit_events(actor_id,action,details) VALUES(auth.uid(),'delivery_zone.saved',jsonb_build_object('zone_id',p_id,'fee_minor',p_fee_minor,'active',p_active));
END $$;

CREATE FUNCTION public.shena_place_order(p_lines jsonb,p_location jsonb,p_zone_id uuid,p_contact jsonb,p_idempotency_key uuid,p_expected_total_minor bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE uid uuid:=auth.uid();cfg public.commerce_settings;old public.commerce_orders;z public.commerce_delivery_zones;
 r record;subtotal bigint:=0;fee bigint:=0;total bigint;physical boolean:=false;found_count integer:=0;pid uuid:=gen_random_uuid();
 pname text;phone text;address text;note text;payload jsonb;num text;
BEGIN
 SELECT * INTO cfg FROM public.commerce_settings WHERE singleton FOR SHARE;
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Compte vérifié requis' USING ERRCODE='42501'; END IF;
 IF NOT cfg.orders_enabled OR cfg.reservation_minutes IS NULL THEN RAISE EXCEPTION 'Commandes désactivées'; END IF;
 IF p_idempotency_key IS NULL OR p_expected_total_minor IS NULL OR p_expected_total_minor<0 THEN RAISE EXCEPTION 'Requête incomplète'; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Panier invalide'; END IF;
 IF jsonb_array_length(p_lines) NOT BETWEEN 1 AND 50 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_lines) l WHERE
   jsonb_typeof(l) IS DISTINCT FROM 'object' OR jsonb_typeof(l->'id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(l->'quantity') IS DISTINCT FROM 'number' OR (l->>'quantity') !~ '^[0-9]+$'
   OR length(l->>'quantity')>3 OR (l->>'quantity')::integer NOT BETWEEN 1 AND 100) THEN RAISE EXCEPTION 'Quantités invalides'; END IF;
 IF (SELECT count(DISTINCT (l->>'id')::uuid) FROM jsonb_array_elements(p_lines) l)<>jsonb_array_length(p_lines) THEN RAISE EXCEPTION 'Produit dupliqué'; END IF;
 IF jsonb_typeof(p_contact) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Coordonnées requises'; END IF;
 pname:=btrim(p_contact->>'name');phone:=btrim(p_contact->>'phone');address:=COALESCE(btrim(p_contact->>'address'),'');note:=COALESCE(btrim(p_contact->>'note'),'');
 IF pname IS NULL OR length(pname) NOT BETWEEN 2 AND 120 OR phone IS NULL OR phone !~ '^[+0-9() -]{7,32}$' OR length(address)>500 OR length(note)>1000 THEN RAISE EXCEPTION 'Coordonnées invalides'; END IF;
 payload:=jsonb_build_object('lines',p_lines,'location',p_location,'zone_id',p_zone_id,'contact',jsonb_build_object('name',pname,'phone',phone,'address',address,'note',note),'expected_total',p_expected_total_minor);
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||':'||p_idempotency_key::text,0));
 SELECT * INTO old FROM public.commerce_orders WHERE customer_id=uid AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN
   IF old.idempotency_payload<>payload THEN RAISE EXCEPTION 'Clé déjà utilisée pour une requête différente'; END IF;
   RETURN jsonb_build_object('id',old.id,'order_number',old.order_number,'status',old.status);
 END IF;
 -- Une même session client ne peut réserver indéfiniment via des commandes parallèles.
 PERFORM pg_advisory_xact_lock(hashtextextended('shena-customer:'||uid::text,0));
 IF (SELECT count(*) FROM public.commerce_orders WHERE customer_id=uid AND status='pending_payment')>=3 THEN RAISE EXCEPTION 'Trop de commandes en attente : contacter la boutique'; END IF;
 FOR r IN SELECT p.*,l.quantity FROM jsonb_to_recordset(p_lines) AS l(id uuid,quantity integer) JOIN public.products p ON p.id=l.id ORDER BY p.id FOR UPDATE OF p LOOP
   found_count:=found_count+1;
   IF r.active IS NOT TRUE OR r.price_htg IS NULL OR r.price_htg::text IN('NaN','Infinity','-Infinity') OR r.price_htg NOT BETWEEN 0 AND 100000000 OR r.price_htg<>round(r.price_htg,2) THEN RAISE EXCEPTION 'Produit indisponible ou prix à vérifier'; END IF;
   IF r.product_type IN('physical','stock','physical_stock','physique','in_stock') THEN
     physical:=true;IF r.stock IS NULL OR r.stock<r.quantity THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;
   ELSIF r.product_type IN('digital','numerique','numérique') THEN
     IF r.quantity<>1 THEN RAISE EXCEPTION 'Licence numérique unique'; END IF;
   ELSE RAISE EXCEPTION 'Type ou précommande non pris en charge'; END IF;
   subtotal:=subtotal+(r.price_htg*100)::bigint*r.quantity;
 END LOOP;
 IF found_count<>jsonb_array_length(p_lines) THEN RAISE EXCEPTION 'Produit absent'; END IF;
 IF physical THEN
   IF jsonb_typeof(p_location) IS DISTINCT FROM 'object' OR p_zone_id IS NULL OR length(address)<8 THEN RAISE EXCEPTION 'Destination et adresse requises'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.commerce_communes WHERE department_id=p_location->>'departmentId' AND id=p_location->>'communeId') THEN RAISE EXCEPTION 'Destination non prise en charge'; END IF;
   SELECT * INTO z FROM public.commerce_delivery_zones WHERE id=p_zone_id AND active
    AND department_id=p_location->>'departmentId' AND (commune_id IS NULL OR commune_id=p_location->>'communeId') FOR SHARE;
   IF NOT FOUND OR COALESCE(length(p_location->>'communeId'),0)=0 THEN RAISE EXCEPTION 'Zone non disponible'; END IF;
   fee:=z.fee_minor;
 ELSE p_zone_id:=NULL;p_location:=NULL; END IF;
 total:=subtotal+fee;
 IF total<>p_expected_total_minor THEN RAISE EXCEPTION 'Montant modifié : recalcul requis'; END IF;
 INSERT INTO public.commerce_orders(id,customer_id,idempotency_key,idempotency_payload,subtotal_minor,delivery_minor,total_minor,customer_name,customer_phone,delivery_address,note,department_id,commune_id,zone_id,zone_name,reservation_expires_at)
 VALUES(pid,uid,p_idempotency_key,payload,subtotal,fee,total,pname,phone,address,note,p_location->>'departmentId',p_location->>'communeId',p_zone_id,z.name,now()+make_interval(mins=>cfg.reservation_minutes)) RETURNING order_number INTO num;
 FOR r IN SELECT p.*,l.quantity FROM jsonb_to_recordset(p_lines) AS l(id uuid,quantity integer) JOIN public.products p ON p.id=l.id ORDER BY p.id LOOP
   INSERT INTO public.commerce_order_lines(order_id,product_id,product_name,product_type,quantity,unit_price_minor,total_minor)
   VALUES(pid,r.id,r.name,CASE WHEN r.product_type IN('digital','numerique','numérique') THEN 'digital' ELSE 'physical' END,r.quantity,(r.price_htg*100)::bigint,(r.price_htg*100)::bigint*r.quantity);
   IF r.product_type IN('physical','stock','physical_stock','physique','in_stock') THEN UPDATE public.products SET stock=stock-r.quantity WHERE id=r.id; END IF;
 END LOOP;
 INSERT INTO public.commerce_audit_events(order_id,actor_id,action,details) VALUES(pid,uid,'order.created',jsonb_build_object('total_minor',total,'currency','HTG'));
 RETURN jsonb_build_object('id',pid,'order_number',num,'status','pending_payment');
END $$;

CREATE FUNCTION public.shena_transition_order(p_order_id uuid,p_status text,p_expected_version integer,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.commerce_orders;r record;
BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_settings WHERE singleton AND orders_enabled) THEN RAISE EXCEPTION 'Commandes désactivées'; END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Justification requise'; END IF;
 SELECT * INTO o FROM public.commerce_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR p_expected_version IS NULL OR o.version<>p_expected_version THEN RAISE EXCEPTION 'Commande absente ou version modifiée'; END IF;
 IF p_status IS NULL OR NOT ((o.status='pending_payment' AND p_status='cancelled') OR(o.status='paid' AND p_status='processing') OR(o.status='processing' AND p_status IN('shipped','delivered')) OR(o.status='shipped' AND p_status='delivered')) THEN RAISE EXCEPTION 'Transition interdite ou paiement non vérifié'; END IF;
 IF p_status='cancelled' THEN
   FOR r IN SELECT l.product_id,l.quantity FROM public.commerce_order_lines l WHERE l.order_id=o.id AND l.product_type='physical' ORDER BY l.product_id LOOP
     UPDATE public.products SET stock=stock+r.quantity WHERE id=r.product_id;
   END LOOP;
 END IF;
 UPDATE public.commerce_orders SET status=p_status,version=version+1 WHERE id=o.id;
 INSERT INTO public.commerce_audit_events(order_id,actor_id,action,details) VALUES(o.id,auth.uid(),'order.status_changed',jsonb_build_object('from',o.status,'to',p_status,'note',btrim(p_note)));
END $$;

CREATE FUNCTION public.shena_submit_payment_review(p_order_id uuid,p_provider text,p_external_reference text,p_amount_minor bigint,p_note text,p_idempotency_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.commerce_orders;r public.commerce_payment_reviews;rid uuid;receiver public.commerce_payment_accounts;
BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_settings WHERE singleton AND orders_enabled AND manual_payments_enabled) THEN RAISE EXCEPTION 'Paiements manuels désactivés'; END IF;
 IF p_idempotency_key IS NULL OR p_provider IS NULL OR p_provider NOT IN('moncash','natcash') OR p_external_reference IS NULL OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Contrôle incomplet'; END IF;
 SELECT * INTO receiver FROM public.commerce_payment_accounts WHERE provider=p_provider AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compte d’encaissement approuvé requis'; END IF;
 p_external_reference:=upper(btrim(p_external_reference));
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_idempotency_key::text,0));
 SELECT * INTO r FROM public.commerce_payment_reviews WHERE submitted_by=auth.uid() AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
   IF r.order_id=p_order_id AND r.provider=p_provider AND r.external_reference=p_external_reference AND r.amount_minor=p_amount_minor AND r.submit_note=btrim(p_note) THEN RETURN r.id; END IF;
   RAISE EXCEPTION 'Clé réutilisée pour un autre contrôle';
 END IF;
 SELECT * INTO o FROM public.commerce_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'pending_payment' OR o.reservation_expires_at<=now() OR p_amount_minor IS NULL OR p_amount_minor<>o.total_minor THEN RAISE EXCEPTION 'Commande, montant ou délai invalide'; END IF;
 INSERT INTO public.commerce_payment_reviews(order_id,provider,external_reference,amount_minor,submitted_by,submit_note,idempotency_key,receiver_snapshot)
 VALUES(o.id,p_provider,p_external_reference,p_amount_minor,auth.uid(),btrim(p_note),p_idempotency_key,jsonb_build_object('provider',receiver.provider,'display_name',receiver.display_name,'account_identifier',receiver.account_identifier)) RETURNING id INTO rid;
 INSERT INTO public.commerce_audit_events(order_id,actor_id,action,details) VALUES(o.id,auth.uid(),'payment.review_submitted',jsonb_build_object('review_id',rid));
 RETURN rid;
END $$;
CREATE FUNCTION public.shena_decide_payment_review(p_review_id uuid,p_decision text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE r public.commerce_payment_reviews;o public.commerce_orders;oid uuid;
BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.commerce_settings WHERE singleton AND orders_enabled AND manual_payments_enabled) THEN RAISE EXCEPTION 'Paiements manuels désactivés'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN('approved','rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Décision incomplète'; END IF;
 SELECT order_id INTO oid FROM public.commerce_payment_reviews WHERE id=p_review_id;
 SELECT * INTO o FROM public.commerce_orders WHERE id=oid FOR UPDATE;
 SELECT * INTO r FROM public.commerce_payment_reviews WHERE id=p_review_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' OR r.submitted_by=auth.uid() OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.submitted_by AND u.email_confirmed_at IS NOT NULL AND u.raw_app_meta_data->'shena_role'='"admin"'::jsonb) OR o.status<>'pending_payment' OR r.amount_minor<>o.total_minor OR o.reservation_expires_at<=now() THEN RAISE EXCEPTION 'Second administrateur distinct et commande valide requis'; END IF;
 UPDATE public.commerce_payment_reviews SET status=p_decision,verified_by=auth.uid(),verified_at=now(),review_note=btrim(p_note) WHERE id=r.id;
 IF p_decision='approved' THEN UPDATE public.commerce_orders SET status='paid',payment_verified_review_id=r.id,version=version+1 WHERE id=o.id; END IF;
 INSERT INTO public.commerce_audit_events(order_id,actor_id,action,details) VALUES(o.id,auth.uid(),'payment.review_'||p_decision,jsonb_build_object('review_id',r.id,'submitted_by',r.submitted_by));
END $$;
CREATE FUNCTION public.shena_admin_commerce_metrics() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $$ BEGIN
 IF NOT public.shena_is_admin() THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('orderCount',count(*),'pendingCount',count(*) FILTER(WHERE o.status='pending_payment'),
 'verifiedRevenueMinor',COALESCE(sum(o.total_minor) FILTER(WHERE o.status IN('paid','processing','shipped','delivered') AND r.status='approved' AND r.verified_by IS NOT NULL AND r.verified_by<>r.submitted_by),0))
 FROM public.commerce_orders o LEFT JOIN public.commerce_payment_reviews r ON r.id=o.payment_verified_review_id);
END $$;
REVOKE ALL ON FUNCTION public.shena_admin_commerce_metrics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_admin_commerce_metrics() TO authenticated;
-- Aucun RPC de remboursement simulé, webhook fournisseur, lien signé ou livraison digitale.
-- Aucun adaptateur MonCash/NatCash/cartes inventé : vérification externe manuelle uniquement.
REVOKE ALL ON FUNCTION public.shena_checkout_features(),public.shena_save_delivery_zone(uuid,text,text,text,bigint,boolean),public.shena_place_order(jsonb,jsonb,uuid,jsonb,uuid,bigint),public.shena_transition_order(uuid,text,integer,text),public.shena_submit_payment_review(uuid,text,text,bigint,text,uuid),public.shena_decide_payment_review(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_checkout_features() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shena_save_delivery_zone(uuid,text,text,text,bigint,boolean),public.shena_place_order(jsonb,jsonb,uuid,jsonb,uuid,bigint),public.shena_transition_order(uuid,text,integer,text),public.shena_submit_payment_review(uuid,text,text,bigint,text,uuid),public.shena_decide_payment_review(uuid,text,text) TO authenticated;
-- Propriétaire postgres par précondition ; pas de changement de rôle ou BYPASSRLS client.
-- Activer plus tard, après accord et recette : durée de réservation explicite, orders,
-- puis paiements manuels séparément. Aucun UPDATE settings d'activation dans ce fichier.
-- Exécution réservée à l'opérateur/planificateur : aucun RPC client de libération de stock.
CREATE INDEX commerce_orders_pending_expiry ON public.commerce_orders(reservation_expires_at,id) WHERE status='pending_payment';
CREATE FUNCTION public.shena_expire_unpaid_reservations(p_limit integer DEFAULT 100) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.commerce_orders;r record;expired integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Limite invalide'; END IF;
 FOR o IN SELECT * FROM public.commerce_orders WHERE status='pending_payment' AND reservation_expires_at<=now()
 ORDER BY reservation_expires_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
   FOR r IN SELECT product_id,quantity FROM public.commerce_order_lines WHERE order_id=o.id AND product_type='physical' ORDER BY product_id LOOP
     UPDATE public.products SET stock=stock+r.quantity WHERE id=r.product_id;
   END LOOP;
   UPDATE public.commerce_orders SET status='cancelled',version=version+1 WHERE id=o.id;
   INSERT INTO public.commerce_audit_events(order_id,actor_id,action,details) VALUES(o.id,NULL,'order.reservation_expired',jsonb_build_object('previous_status','pending_payment'));
   expired:=expired+1;
 END LOOP;
 RETURN expired;
END $$;
ALTER FUNCTION public.shena_expire_unpaid_reservations(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.shena_expire_unpaid_reservations(integer) FROM PUBLIC,anon,authenticated;
-- Version persistante DISTINCTE : les fichiers de revue gardent ROLLBACK.
COMMIT;
