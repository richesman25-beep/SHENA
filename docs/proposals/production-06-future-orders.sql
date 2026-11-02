-- ARCHITECTURE FUTURE NON EXÉCUTÉE. NE PAS activer avec cette phase admin.
-- Montants entiers en centimes HTG. Totaux/lignes immuables validés côté serveur.
BEGIN;
CREATE TABLE public.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'pending_payment' CHECK(status IN('pending_payment','paid','processing','shipped','delivered','cancelled','refunded')),
 currency text NOT NULL DEFAULT 'HTG' CHECK(currency='HTG'),
 total_minor bigint NOT NULL CHECK(total_minor>=0), idempotency_key uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id),
 product_id uuid NOT NULL REFERENCES public.products(id), name_snapshot text NOT NULL,
 product_type_snapshot text NOT NULL CHECK(product_type_snapshot IN('physical','digital')),
 quantity integer NOT NULL CHECK(quantity>0), unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0)
);
CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id),
 provider text NOT NULL CHECK(provider IN('moncash','natcash','international')), provider_transaction_id text NOT NULL,
 status text NOT NULL CHECK(status IN('pending','verified','failed','refunded')),
 amount_minor bigint NOT NULL CHECK(amount_minor>=0), currency text NOT NULL CHECK(currency='HTG'),
 verified_at timestamptz, UNIQUE(provider,provider_transaction_id),
 CHECK(status<>'verified' OR verified_at IS NOT NULL)
);
CREATE TABLE public.payment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL,
 provider_event_id text NOT NULL, payment_id uuid REFERENCES public.payments(id),
 payload_digest text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 UNIQUE(provider,provider_event_id)
);
CREATE TABLE public.shipments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id),
 status text NOT NULL CHECK(status IN('processing','shipped','delivered','cancelled')), carrier text, tracking_reference text
);
CREATE TABLE public.digital_entitlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES auth.users(id),
 order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id),
 asset_id uuid NOT NULL REFERENCES public.digital_assets(id), revoked_at timestamptz
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders,public.order_items,public.payments,public.payment_events,public.shipments,public.digital_entitlements FROM anon,authenticated;
-- Aucun accès ni écriture accordé, même au rôle admin applicatif, dans cette proposition.
-- À concevoir avant activation : isolation client SELECT, checkout serveur atomique,
-- réservation stock/emplacement, validation des transitions, signature fournisseur,
-- montant/devise/bénéficiaire concordants et unicité des événements, rapprochement,
-- remboursement/révocation, adresse privée et livraison. Ne jamais croire une redirection.
-- Pas de fonction de lien signé : seulement après commande payée ET fichier analysé,
-- droits de la session courante revalidés, durée courte et révocation possible.
ROLLBACK;
